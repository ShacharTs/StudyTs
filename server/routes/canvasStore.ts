import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { route } from '../utils/routeHandler.js';
import { sceneIdWhere } from './topicCrud.js';
import { convertSceneToDocState, convertDocStateToCanvasScene } from '../../src/core/canvasBlocks/sceneDocConverter.js';
import { commitScene } from '../utils/commitScene.js';

export const canvasStoreRouter = Router();

function sceneVersion(scene: Record<string, unknown>): number {
  return typeof scene.version === 'number' ? scene.version : 0;
}

function sceneBlockCount(scene: Record<string, unknown>): number {
  const pages = Array.isArray(scene.pages) ? (scene.pages as Array<{ blocks?: unknown[] }>) : [];
  const pageBlocks = pages.reduce((n, page) => n + (page.blocks?.length ?? 0), 0);
  return pageBlocks + (Array.isArray(scene.blocks) ? scene.blocks.length : 0);
}

function docObjectCount(doc: Record<string, unknown>): number {
  const objects = doc.objects;
  return objects && typeof objects === 'object' ? Object.keys(objects).length : 0;
}

/** The editor may only overwrite the scene it actually loaded; anything else would silently discard newer (AI) content. */
function editorSaveConflict(scene: Record<string, unknown>, doc: Record<string, unknown>, baseVersion: unknown): string | null {
  if (typeof baseVersion === 'number' && baseVersion !== sceneVersion(scene)) {
    return `Conflict: the scene changed since it was loaded (editor had version ${baseVersion}, server has ${sceneVersion(scene)}). Reload the scene.`;
  }
  // With a matching baseVersion an empty document is a deliberate clear; without one it is most likely a never-loaded editor.
  if (baseVersion === undefined && docObjectCount(doc) === 0 && sceneBlockCount(scene) > 0) {
    return 'Refusing to replace a non-empty scene with an empty document. Reload the scene.';
  }
  return null;
}

export async function handleSave(req: Request, res: Response): Promise<void> {
  const prisma: PrismaClient = req.prisma;
  const { key, doc, baseVersion } = req.body;
  if (typeof key !== 'string' || !key) {
    return void res.status(400).json({ error: 'key must be a non-empty string' });
  }
  if (!doc || typeof doc !== 'object') {
    return void res.status(400).json({ error: 'doc must be an object' });
  }

  const topic = prisma.topic ? await prisma.topic.findFirst({ where: sceneIdWhere(key) }) : null;
  const existingScene = (topic?.scene as Record<string, unknown>) || {};
  const conflict = topic ? editorSaveConflict(existingScene, doc, baseVersion) : null;
  if (conflict) {
    return void res.status(409).json({ error: conflict, currentVersion: sceneVersion(existingScene) });
  }

  await prisma.canvasStoreDoc.upsert({
    where: { key },
    create: { key, doc },
    update: { doc },
  });

  if (!topic) return void res.json({ success: true });
  const updatedScene = convertDocStateToCanvasScene(doc, existingScene);
  await commitScene(prisma, topic, updatedScene, 'editor');
  res.json({ success: true, version: sceneVersion(updatedScene) });
}

export async function handleLoad(req: Request, res: Response): Promise<void> {
  const prisma: PrismaClient = req.prisma;
  const key = req.query.key;
  if (typeof key !== 'string' || !key) {
    return void res.status(400).json({ error: 'key query parameter must be a non-empty string' });
  }
  const topic = prisma.topic ? await prisma.topic.findFirst({ where: sceneIdWhere(key) }) : null;
  const scene = topic?.scene && typeof topic.scene === 'object' ? (topic.scene as Record<string, unknown>) : null;
  const version = scene ? sceneVersion(scene) : undefined;

  const record = await prisma.canvasStoreDoc.findUnique({ where: { key } });
  if (record?.doc) return void res.json({ doc: record.doc, version });
  if (scene) return void res.json({ doc: convertSceneToDocState(scene), version });
  return void res.status(404).json({ error: `No canvas-store doc found for key '${key}'` });
}

canvasStoreRouter.post('/canvas-store/save', route(handleSave));
canvasStoreRouter.get('/canvas-store/load', route(handleLoad));

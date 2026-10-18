/**
 * Saved VisualSpecs for the standalone authoring page. The database row is the source of truth; every save also
 * mirrors data/_shared/visual-specs/<key>.json, and load falls back to that file when the row is missing.
 */
import { Router, Request, Response } from 'express';
import type { Prisma, PrismaClient } from '@prisma/client';
import { route } from '../utils/routeHandler.js';
import { visualSpecFiles } from '../utils/visualSpecFiles.js';
import { checkVisualSpec } from '../../src/core/validation/visualSpec/visualSpecJson.js';
import { VISUAL_SPEC_KEY_PATTERN, isVisualSpecKey } from '../../src/core/validation/visualSpec/visualSpecKey.js';

export const visualSpecsRouter = Router();

const invalidKeyBody = { error: `key must match ${VISUAL_SPEC_KEY_PATTERN}` };

export async function handleList(req: Request, res: Response): Promise<void> {
  const prisma: PrismaClient = req.prisma;
  const rows = await prisma.visualSpecDoc.findMany({ select: { key: true } });
  const keys = new Set([...rows.map((row) => row.key), ...visualSpecFiles.listKeys()]);
  res.json({ keys: [...keys].sort() });
}

export async function handleLoad(req: Request, res: Response): Promise<void> {
  const prisma: PrismaClient = req.prisma;
  const key = req.params.key;
  if (!isVisualSpecKey(key)) return void res.status(400).json(invalidKeyBody);

  const row = await prisma.visualSpecDoc.findUnique({ where: { key } });
  if (row) return void res.json({ spec: row.spec });

  const mirrored = visualSpecFiles.read(key);
  if (mirrored) return void res.json({ spec: mirrored.spec });
  return void res.status(404).json({ error: `No visual spec found for key '${key}'` });
}

export async function handleSave(req: Request, res: Response): Promise<void> {
  const prisma: PrismaClient = req.prisma;
  const key = req.params.key;
  if (!isVisualSpecKey(key)) return void res.status(400).json(invalidKeyBody);

  const checked = checkVisualSpec(req.body?.spec);
  if (!checked.spec || checked.problems.length > 0) {
    return void res.status(400).json({ error: 'Invalid VisualSpec', problems: checked.problems });
  }

  const spec = req.body.spec as Prisma.InputJsonObject;
  await prisma.visualSpecDoc.upsert({ where: { key }, create: { key, spec }, update: { spec } });
  visualSpecFiles.write(key, spec);
  res.json({ success: true });
}

visualSpecsRouter.get('/visual-specs', route(handleList));
visualSpecsRouter.get('/visual-specs/:key', route(handleLoad));
visualSpecsRouter.put('/visual-specs/:key', route(handleSave));

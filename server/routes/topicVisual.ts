/**
 * Saves a step-player (VisualSpec) into an existing topic's `model`. Creating a step-player topic leaves the model
 * empty on purpose; this is the call that fills it once the author has built the visualization.
 */
import { Request, Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import { syncTopicToFiles } from '../utils/fileSync.js';
import { invalidateRegistryCache } from '../utils/registryCache.js';
import { cacheService } from '../cache/cacheService.js';
import { checkVisualSpec } from '../../src/core/validation/visualSpec/visualSpecJson.js';
import { knownContentLanguages } from '../utils/i18nHelper.js';

async function dropContentCache(courseId: string, weekKey: string, section: string, topicId: string): Promise<void> {
  const base = `content_${courseId}_${weekKey}_${section}_${topicId}`;
  const variants = ['raw', ...knownContentLanguages()];
  await Promise.all(variants.map((variant) => cacheService.delete(`${base}_${variant}`)));
}

interface Problem {
  status: number;
  body: Record<string, unknown>;
}

type Found = { topic: { id: number; topicId: string } } | { problem: Problem };

async function findStepPlayerTopic(prisma: PrismaClient, courseId: string, weekKey: string, section: string, topicId: string): Promise<Found> {
  const week = await prisma.week.findUnique({ where: { courseId_weekKey: { courseId, weekKey } } });
  if (!week) return { problem: { status: 404, body: { error: `No course '${courseId}' or week '${weekKey}' found` } } };

  const topic = await prisma.topic.findUnique({ where: { weekId_section_topicId: { weekId: week.id, section, topicId } } });
  if (!topic) return { problem: { status: 404, body: { error: `Topic '${topicId}' not found` } } };
  // A canvas topic is rendered from its scene; writing a model into it would be silently ignored.
  if (topic.scene) return { problem: { status: 409, body: { error: `Topic '${topicId}' is a canvas topic, not a step player` } } };
  return { topic };
}

interface SaveRequest {
  courseId: string;
  weekKey: string;
  section: string;
  topicId: string;
  spec: unknown;
}

function badRequest(body: Record<string, unknown>): { problem: Problem } {
  return { problem: { status: 400, body } };
}

const COORDINATES = ['courseId', 'weekKey', 'section', 'topicId'] as const;

function readSaveRequest(raw: Record<string, unknown> | undefined): SaveRequest | { problem: Problem } {
  const body = raw ?? {};
  if (COORDINATES.some((key) => !body[key])) return badRequest({ error: 'courseId, weekKey, section and topicId are required' });
  const checked = checkVisualSpec(body.spec);
  if (!checked.spec || checked.problems.length > 0) return badRequest({ error: 'Invalid VisualSpec', problems: checked.problems });
  return body as unknown as SaveRequest;
}

export async function handleTopicVisualSave(req: Request, res: Response): Promise<void> {
  const prisma: PrismaClient = req.prisma;
  const request = readSaveRequest(req.body);
  if ('problem' in request) return void res.status(request.problem.status).json(request.problem.body);

  const { courseId, weekKey, section, topicId, spec } = request;
  const found = await findStepPlayerTopic(prisma, courseId, weekKey, section, topicId);
  if ('problem' in found) return void res.status(found.problem.status).json(found.problem.body);

  const updated = await prisma.topic.update({ where: { id: found.topic.id }, data: { model: spec as Prisma.InputJsonObject } });
  await syncTopicToFiles(prisma, updated.id);
  invalidateRegistryCache();
  await dropContentCache(courseId, weekKey, section, topicId);
  res.json({ updatedId: found.topic.topicId });
}

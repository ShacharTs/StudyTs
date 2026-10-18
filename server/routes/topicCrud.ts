import { Request, Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import { syncTopicToFiles, syncCourseToFile, removeTopicFiles } from '../utils/fileSync.js';
import { invalidateRegistryCache } from '../utils/registryCache.js';
import { cacheService } from '../cache/cacheService.js';
import { moveTopicInSection, type TopicMove } from './topicOrder.js';
import { isTopicAttachmentList } from '../../src/core/shared/topicAttachment.js';

/**
 * Matches a Topic row by its topicId column OR by the `id` field embedded inside its
 * scene JSON blob — the two are not always equal (e.g. multimodal-canvas-demo's
 * scene.id uses hyphens while its topicId uses underscores), so both arms are required.
 * The string `path: 'id'` form is SQLite-specific; Postgres requires the array form
 * `path: ['id']` instead, so this must change if the datasource ever moves back.
 */
export function sceneIdWhere(sceneId: string): Prisma.TopicWhereInput {
  return {
    OR: [
      { topicId: sceneId },
      { scene: { path: 'id', equals: sceneId } },
    ],
  };
}

/** sceneIdWhere, plus also matching the topic's own numeric primary key when targetId parses as one. */
export function topicOrIdWhere(targetId: string): Prisma.TopicWhereInput {
  const base = sceneIdWhere(targetId);
  const numericId = Number(targetId);
  if (Number.isInteger(numericId) && numericId > 0) {
    return { OR: [...(base.OR as object[]), { id: numericId }] };
  }
  return base;
}

type TopicPayload = {
  id: string;
  title?: Prisma.InputJsonValue;
  description?: Prisma.InputJsonValue;
  contentType?: string;
  attachments?: unknown;
};

async function createTopic(prisma: PrismaClient, weekId: number, courseId: string, section: string, topic: TopicPayload, res: Response): Promise<void> {
  const existing = await prisma.topic.findUnique({
    where: { weekId_section_topicId: { weekId, section, topicId: topic.id } },
  });
  if (existing) return void res.status(400).json({ error: `Topic '${topic.id}' already exists` });

  // New topics default to canvas with an empty scene so clients open the canvas editor directly.
  // stepPlayer and file start with scene: null; a file topic gets its attachments list, which marks it as a file.
  const contentType = topic.contentType === 'stepPlayer' || topic.contentType === 'file' ? topic.contentType : 'canvas';
  const emptyScene = {
    id: topic.id,
    title: topic.title || { en: topic.id },
    canvasSize: { width: 794, height: 1123 },
    pageSize: 'A4',
    blocks: [],
  };

  const created = await prisma.topic.create({
    data: {
      weekId,
      section,
      topicId: topic.id,
      position: await prisma.topic.count({ where: { weekId, section } }),
      title: topic.title || { en: topic.id },
      description: topic.description || { en: '' },
      scene: contentType === 'canvas' ? emptyScene : Prisma.JsonNull,
      content: Prisma.JsonNull,
      model: Prisma.JsonNull,
      attachments: contentType === 'file' ? [] : Prisma.JsonNull,
    },
  });

  await syncTopicToFiles(prisma, created.id);
  await syncCourseToFile(prisma, courseId);
  invalidateRegistryCache();
  res.json({ updatedId: created.topicId });
}

async function updateTopic(prisma: PrismaClient, weekId: number, courseId: string, section: string, topic: TopicPayload, res: Response): Promise<void> {
  const { id: topicId, ...fields } = topic;
  if (fields.attachments !== undefined && !isTopicAttachmentList(fields.attachments)) {
    return void res.status(400).json({ error: 'attachments must be a list of attachment records' });
  }
  const updated = await prisma.topic.update({
    where: { weekId_section_topicId: { weekId, section, topicId } },
    data: {
      ...(fields.title && { title: fields.title }),
      ...(fields.description && { description: fields.description }),
      ...(fields.attachments !== undefined && { attachments: fields.attachments as unknown as Prisma.InputJsonValue }),
    },
  });
  await syncTopicToFiles(prisma, updated.id);
  await syncCourseToFile(prisma, courseId);
  invalidateRegistryCache();
  res.json({ updatedId: updated.topicId });
}

async function deleteTopic(prisma: PrismaClient, weekId: number, courseId: string, weekKey: string, section: string, topicId: string, res: Response): Promise<void> {
  const topicRecord = await prisma.topic.findUnique({
    where: { weekId_section_topicId: { weekId, section, topicId } },
  });
  if (!topicRecord) return void res.status(404).json({ error: `Topic '${topicId}' not found` });

  await prisma.topic.delete({
    where: { weekId_section_topicId: { weekId, section, topicId } },
  });

  removeTopicFiles(courseId, weekKey, section, topicId);
  invalidateRegistryCache();
  res.json({ updatedId: topicId });
}

async function moveTopic(prisma: PrismaClient, weekId: number, courseId: string, section: string, topic: TopicPayload & TopicMove, res: Response): Promise<void> {
  const result = await moveTopicInSection(prisma, weekId, section, topic.id, topic);
  if ('error' in result) return void res.status(result.status).json({ error: result.error });
  await syncCourseToFile(prisma, courseId);
  invalidateRegistryCache();
  res.json({ updatedId: topic.id, order: result.order });
}

function isValidTopicPayload(courseId?: string, weekKey?: string, section?: string, topicId?: string): boolean {
  return Boolean(courseId && weekKey && section && topicId);
}

export async function handleTopicCrud(req: Request, res: Response): Promise<void> {
  const prisma: PrismaClient = req.prisma;
  const { courseId, weekKey, section, action, topic } = req.body;

  if (!isValidTopicPayload(courseId, weekKey, section, topic?.id)) {
    return void res.status(400).json({ error: 'courseId, weekKey, section, and topic.id are required' });
  }

  const week = await prisma.week.findUnique({ where: { courseId_weekKey: { courseId, weekKey } } });
  if (!week) return void res.status(404).json({ error: `No course '${courseId}' or week '${weekKey}' found` });

  try {
    return await runTopicAction(prisma, week.id, { courseId, weekKey, section, action, topic }, res);
  } finally {
    // Content is cached for two minutes per topic; a save must not leave the old copy in place.
    await forgetTopicContent(courseId, weekKey, section, topic.id);
  }
}

async function runTopicAction(
  prisma: PrismaClient,
  weekId: number,
  request: { courseId: string; weekKey: string; section: string; action: string; topic: TopicPayload & TopicMove },
  res: Response
): Promise<void> {
  const { courseId, weekKey, section, action, topic } = request;
  if (action === 'create') return await createTopic(prisma, weekId, courseId, section, topic, res);
  if (action === 'update') return await updateTopic(prisma, weekId, courseId, section, topic, res);
  if (action === 'delete') return await deleteTopic(prisma, weekId, courseId, weekKey, section, topic.id, res);
  if (action === 'move') return await moveTopic(prisma, weekId, courseId, section, topic, res);
  return void res.status(400).json({ error: 'Invalid action' });
}

const CONTENT_LANGUAGES = ['en', 'he'];

async function forgetTopicContent(courseId: string, weekKey: string, section: string, topicId: string): Promise<void> {
  const base = `content_${courseId}_${weekKey}_${section}_${topicId}`;
  const keys = [`${base}_raw`, ...CONTENT_LANGUAGES.map((lang) => `${base}_${lang}`)];
  await Promise.all(keys.map((key) => cacheService.delete(key)));
}

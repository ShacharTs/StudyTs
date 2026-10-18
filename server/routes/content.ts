/**
 * GET /api/content/:courseId/:weekKey/:section/:topicId
 * Returns scene/model/content data for a single topic.
 * Supports caching via cacheService and language resolution via ?lang=he|en.
 */

import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { route } from '../utils/routeHandler.js';
import { cacheService } from '../cache/cacheService.js';
import { resolveLangFromRequest, localizePayload } from '../utils/i18nHelper.js';

export const contentRouter = Router();

contentRouter.get('/content/:courseId/:weekKey/:section/:topicId', route(async (req, res) => {
  const { courseId, weekKey, section, topicId } = req.params;
  const isResolved = req.query.resolve === 'true' || Boolean(req.query.lang);
  const lang = resolveLangFromRequest(req);
  const cacheKey = `content_${courseId}_${weekKey}_${section}_${topicId}_${isResolved ? lang : 'raw'}`;

  const cached = await cacheService.get<Record<string, unknown>>(cacheKey);
  if (cached) {
    return void res.json(cached);
  }

  const prisma: PrismaClient = req.prisma;

  const week = await prisma.week.findUnique({
    where: { courseId_weekKey: { courseId, weekKey } },
  });

  if (!week) {
    return void res.status(404).json({ error: 'Week not found' });
  }

  const topic = await prisma.topic.findUnique({
    where: { weekId_section_topicId: { weekId: week.id, section, topicId } },
  });

  if (!topic) {
    return void res.status(404).json({ error: 'Topic not found' });
  }

  const scene = topic.scene ? { ...(topic.scene as Record<string, unknown>), id: topic.topicId } : null;

  const rawPayload = {
    id: topic.topicId,
    title: topic.title,
    description: topic.description,
    scene,
    model: topic.model ?? null,
    content: topic.content ?? null,
    attachments: topic.attachments,
  };

  await cacheService.set(`content_${courseId}_${weekKey}_${section}_${topicId}_raw`, rawPayload, 120);

  if (isResolved) {
    const localized = localizePayload(rawPayload, lang);
    await cacheService.set(cacheKey, localized, 120);
    return void res.json(localized);
  }

  res.json(rawPayload);
}));

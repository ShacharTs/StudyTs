/**
 * GET /api/registry — Returns full course catalog from SQLite.
 * Supports server-side localization via ?lang=he|en and caching via cacheService (Redis / in-memory).
 */

import { Router } from 'express';
import { Prisma, PrismaClient } from '@prisma/client';
import { route } from '../utils/routeHandler.js';
import { cacheService } from '../cache/cacheService.js';
import { getCachedRegistry, setCachedRegistry, registryGeneration } from '../utils/registryCache.js';
import { bySectionOrder } from './topicOrder.js';
import { resolveLangFromRequest, localizePayload } from '../utils/i18nHelper.js';

export const registryRouter = Router();

registryRouter.get('/registry', route(async (req, res) => {
  const isResolved = req.query.resolve === 'true' || Boolean(req.query.lang);
  const lang = resolveLangFromRequest(req);
  const cacheKey = `course_registry_${isResolved ? lang : 'raw'}`;

  if (!isResolved) {
    const memoryHit = getCachedRegistry();
    if (memoryHit) return void res.json(memoryHit);
  }

  const cached = await cacheService.get<Record<string, unknown>>(cacheKey);
  if (cached) {
    return void res.json(cached);
  }

  const readGeneration = registryGeneration();
  const prisma: PrismaClient = req.prisma;

  const courses = await prisma.course.findMany({
    include: {
      // Creation order: without it SQLite returns rows by its unique index (alphabetical), which put new sections first.
      weeks: {
        orderBy: { id: 'asc' },
        include: {
          topics: {
            orderBy: [...bySectionOrder],
            select: {
              topicId: true,
              title: true,
              description: true,
              section: true,
              attachments: true,
            },
          },
        },
      },
    },
  });

  // Which topics hold a canvas scene (the rest are step-player topics). The scenes themselves are not loaded here.
  const canvasTopics = await prisma.topic.findMany({
    where: { NOT: { scene: { equals: Prisma.AnyNull } } },
    select: { weekId: true, section: true, topicId: true },
  });
  const canvasKeys = new Set(canvasTopics.map((t) => `${t.weekId}/${t.section}/${t.topicId}`));
  // A file topic is one that has an attachments list; its document is the content.
  const fileTopics = await prisma.topic.findMany({
    where: { NOT: { attachments: { equals: Prisma.AnyNull } } },
    select: { weekId: true, section: true, topicId: true },
  });
  const fileKeys = new Set(fileTopics.map((t) => `${t.weekId}/${t.section}/${t.topicId}`));
  const kindOf = (weekId: number, section: string, topicId: string) => {
    const key = `${weekId}/${section}/${topicId}`;
    if (canvasKeys.has(key)) return 'canvas';
    return fileKeys.has(key) ? 'file' : 'stepPlayer';
  };

  // Transform DB rows into the same shape as COURSE_REGISTRY
  const rawRegistry: Record<string, unknown> = {};

  for (const course of courses) {
    const catalog: Record<string, unknown> = {};

    for (const week of course.weeks) {
      const lectures = week.topics
        .filter((t) => t.section === 'lectures')
        .map((t) => {
          const item = t as { attachments?: unknown };
          return {
            id: t.topicId,
            title: t.title,
            description: t.description,
            ...(item.attachments ? { attachments: item.attachments } : {}),
            contentUrl: `/api/content/${course.id}/${week.weekKey}/lectures/${t.topicId}`,
            kind: kindOf(week.id, 'lectures', t.topicId),
          };
        });

      const practice = week.topics
        .filter((t) => t.section === 'practice')
        .map((t) => {
          const item = t as { attachments?: unknown };
          return {
            id: t.topicId,
            title: t.title,
            description: t.description,
            ...(item.attachments ? { attachments: item.attachments } : {}),
            contentUrl: `/api/content/${course.id}/${week.weekKey}/practice/${t.topicId}`,
            kind: kindOf(week.id, 'practice', t.topicId),
          };
        });

      catalog[week.weekKey] = {
        title: week.title,
        lectures,
        practice,
      };
    }

    rawRegistry[course.id] = {
      id: course.id,
      code: course.code,
      title: course.title,
      subtitle: course.subtitle,
      description: course.description,
      icon: course.icon,
      color: course.color,
      accent: course.accent,
      badge: course.badge,
      catalog,
    };
  }

  // Cache raw registry
  setCachedRegistry(rawRegistry, readGeneration);

  if (isResolved) {
    const localized = localizePayload(rawRegistry, lang);
    if (readGeneration === registryGeneration()) await cacheService.set(cacheKey, localized, 120);
    return void res.json(localized);
  }

  res.json(rawRegistry);
}));

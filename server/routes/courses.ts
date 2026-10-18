/**
 * POST /api/content-editor/course, /week, /topic
 * Course content management routes backed by Prisma.
 */

import { Router, Request, Response } from 'express';
import { handleTopicCrud } from './topicCrud.js';
import { handleTopicVisualSave } from './topicVisual.js';
import { route } from '../utils/routeHandler.js';
import { PrismaClient, Prisma } from '@prisma/client';
import { syncCourseToFile, removeCourseFiles, removeWeekFiles } from '../utils/fileSync.js';
import { invalidateRegistryCache } from '../utils/registryCache.js';

async function createWeek(prisma: PrismaClient, courseId: string, weekKey: string, title: Prisma.InputJsonValue | undefined, res: Response): Promise<void> {
  const existing = await prisma.week.findUnique({
    where: { courseId_weekKey: { courseId, weekKey } },
  });
  if (existing) return void res.status(400).json({ error: `Week '${weekKey}' already exists in course '${courseId}'` });

  const created = await prisma.week.create({
    data: { courseId, weekKey, title: title || { en: weekKey } },
  });

  await syncCourseToFile(prisma, courseId);
  invalidateRegistryCache();
  res.json({ updatedId: created.weekKey });
}

async function updateWeek(prisma: PrismaClient, courseId: string, weekKey: string, title: Prisma.InputJsonValue | undefined, res: Response): Promise<void> {
  const updated = await prisma.week.update({
    where: { courseId_weekKey: { courseId, weekKey } },
    data: { ...(title && { title }) },
  });

  await syncCourseToFile(prisma, courseId);
  invalidateRegistryCache();
  res.json({ updatedId: updated.weekKey });
}

async function deleteWeek(prisma: PrismaClient, courseId: string, weekKey: string, cascade: boolean, res: Response): Promise<void> {
  const week = await prisma.week.findUnique({
    where: { courseId_weekKey: { courseId, weekKey } },
  });
  if (!week) return void res.status(404).json({ error: `Week '${weekKey}' not found` });

  if (!cascade) {
    const topicCount = await prisma.topic.count({ where: { weekId: week.id } });
    if (topicCount > 0) {
      return void res.status(409).json({ error: `Week '${weekKey}' has ${topicCount} topics. Use cascade: true to delete.` });
    }
  }

  await prisma.week.delete({ where: { id: week.id } });
  removeWeekFiles(courseId, weekKey);
  invalidateRegistryCache();
  res.json({ updatedId: weekKey });
}

function isValidWeekPayload(courseId?: string, weekKey?: string): boolean {
  return Boolean(courseId && typeof courseId === 'string' && weekKey && typeof weekKey === 'string');
}

async function handleWeekCrud(req: Request, res: Response): Promise<void> {
  const prisma: PrismaClient = req.prisma;
  const { courseId, action, weekKey, title, cascade = false } = req.body;

  if (!isValidWeekPayload(courseId, weekKey)) {
    return void res.status(400).json({ error: 'courseId and weekKey must be non-empty strings' });
  }

  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) return void res.status(404).json({ error: `No course '${courseId}' found` });

  if (action === 'create') {
    await createWeek(prisma, courseId, weekKey, title, res);
  } else if (action === 'update') {
    await updateWeek(prisma, courseId, weekKey, title, res);
  } else if (action === 'delete') {
    await deleteWeek(prisma, courseId, weekKey, cascade, res);
  } else {
    res.status(400).json({ error: `Unknown action '${action}'. Expected 'create', 'update', or 'delete'.` });
  }
}

interface CoursePayload {
  code?: string;
  title?: Record<string, string>;
  subtitle?: Record<string, string>;
  description?: Record<string, string>;
  icon?: string;
  color?: string;
  accent?: string;
  badge?: Record<string, string>;
}

async function createCourse(prisma: PrismaClient, id: string, course: CoursePayload, res: Response): Promise<void> {
  const existing = await prisma.course.findUnique({ where: { id } });
  if (existing) {
    res.status(400).json({ error: `Course '${id}' already exists` });
    return;
  }

  const created = await prisma.course.create({
    data: {
      id,
      code: course.code || id.toUpperCase(),
      title: course.title || { en: id },
      subtitle: course.subtitle || { en: '' },
      description: course.description || { en: '' },
      icon: course.icon || 'BookOpen',
      color: course.color || 'rgba(100,100,100,0.15)',
      accent: course.accent || '#888888',
      badge: course.badge || { en: '' },
    },
  });

  await syncCourseToFile(prisma, created.id);
  invalidateRegistryCache();
  res.json({ updatedId: created.id });
}

async function updateCourse(prisma: PrismaClient, id: string, course: CoursePayload, res: Response): Promise<void> {
  const updated = await prisma.course.update({
    where: { id },
    data: {
      ...(course.code && { code: course.code }),
      ...(course.title && { title: course.title }),
      ...(course.subtitle && { subtitle: course.subtitle }),
      ...(course.description && { description: course.description }),
      ...(course.icon && { icon: course.icon }),
      ...(course.color && { color: course.color }),
      ...(course.accent && { accent: course.accent }),
      ...(course.badge && { badge: course.badge }),
    },
  });

  await syncCourseToFile(prisma, updated.id);
  invalidateRegistryCache();
  res.json({ updatedId: updated.id });
}

async function deleteCourse(prisma: PrismaClient, id: string, res: Response): Promise<void> {
  await prisma.course.delete({ where: { id } });
  removeCourseFiles(id);
  invalidateRegistryCache();
  res.json({ updatedId: id });
}

async function handleCourseCrud(req: Request, res: Response): Promise<void> {
  const prisma: PrismaClient = req.prisma;
  const { action, id, course = {} } = req.body as { action?: string; id?: string; course?: CoursePayload };

  if (!id || typeof id !== 'string') {
    res.status(400).json({ error: 'Course id must be a non-empty string' });
    return;
  }

  if (action === 'create') return await createCourse(prisma, id, course, res);
  if (action === 'update') return await updateCourse(prisma, id, course, res);
  if (action === 'delete') return await deleteCourse(prisma, id, res);
  res.status(400).json({ error: 'Invalid action' });
}

export const coursesRouter = Router();

// Entity CRUD
coursesRouter.post('/content-editor/course', route(handleCourseCrud));
coursesRouter.post('/content-editor/week', route(handleWeekCrud));
coursesRouter.post('/content-editor/topic', route(handleTopicCrud));
coursesRouter.put('/content-editor/topic-visual', route(handleTopicVisualSave));

// Course ZIP Export & Import

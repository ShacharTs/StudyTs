/**
 * Sync Postgres changes back to data/*.json files for portability.
 * Run after successful DB writes so files stay in sync.
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync, rmSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { createHash } from 'crypto';
import type { PrismaClient } from '@prisma/client';

const ROOT = process.cwd();
const DATA_DIR = join(ROOT, 'data');

function ensureDir(p: string) {
  const d = dirname(p);
  if (!existsSync(d)) {
    mkdirSync(d, { recursive: true });
  }
}

/** Content hash of every file this module wrote, so the data/ watcher can tell our own echo from a real edit. */
const ownWrites = new Map<string, string>();

const sha1 = (text: string): string => createHash('sha1').update(text).digest('hex');

export function writeTracked(path: string, content: string): void {
  writeFileSync(path, content);
  ownWrites.set(resolve(path), sha1(content));
}

/** True when the file still holds exactly what syncTopicToFiles/syncCourseToFile last wrote to it. */
export function isOwnWrite(path: string): boolean {
  const expected = ownWrites.get(resolve(path));
  if (!expected) return false;
  try {
    return sha1(readFileSync(path, 'utf8')) === expected;
  } catch {
    return false;
  }
}

function toJson(obj: unknown): string {
  return JSON.stringify(obj, null, 2);
}

/**
 * Sync a course to its per-course catalog.json file.
 */
export async function syncCourseToFile(prisma: PrismaClient, courseId: string) {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: { weeks: { orderBy: { id: 'asc' }, include: { topics: { orderBy: [{ position: 'asc' }, { id: 'asc' }] } } } },
  });
  if (!course) return;

  const catalogPath = join(DATA_DIR, courseId, 'catalog.json');

  const weeks: Record<string, unknown> = {};
  for (const week of course.weeks) {
    weeks[week.weekKey] = {
      title: week.title,
      lectures: week.topics.filter((t) => t.section === 'lectures').map((t) => ({
        id: t.topicId,
        title: t.title,
        description: t.description,
        ...(t.attachments ? { attachments: t.attachments } : {}),
      })),
      practice: week.topics.filter((t) => t.section === 'practice').map((t) => ({
        id: t.topicId,
        title: t.title,
        description: t.description,
        ...(t.attachments ? { attachments: t.attachments } : {}),
      })),
    };
  }

  ensureDir(catalogPath);
  writeTracked(catalogPath, toJson(weeks));
}

/**
 * Sync topic scene/model/content to JSON files
 */
export async function syncTopicToFiles(prisma: PrismaClient, topicId: number) {
  const topic = await prisma.topic.findUnique({
    where: { id: topicId },
    include: { week: { include: { course: true } } },
  });
  if (!topic) return;

  const { week, section, topicId: tId } = topic;
  const baseDir = join(DATA_DIR, week.courseId, week.weekKey, section, tId);

  if (topic.scene) {
    const scenePath = join(baseDir, 'scene.json');
    ensureDir(scenePath);
    writeTracked(scenePath, toJson(topic.scene));
  }

  if (topic.model) {
    const modelPath = join(baseDir, 'model.json');
    ensureDir(modelPath);
    writeTracked(modelPath, toJson(topic.model));
  }

  if (topic.content) {
    const contentPath = join(baseDir, 'content.json');
    ensureDir(contentPath);
    writeTracked(contentPath, toJson(topic.content));
  }
}

/**
 * Remove a course's synced data/<courseId>/ folder.
 */
export function removeCourseFiles(courseId: string) {
  const courseDir = join(DATA_DIR, courseId);
  if (existsSync(courseDir)) {
    rmSync(courseDir, { recursive: true, force: true });
  }
}

/** Remove a synced data/<courseId>/<weekKey>/ folder. */
export function removeWeekFiles(courseId: string, weekKey: string) {
  const weekDir = join(DATA_DIR, courseId, weekKey);
  if (existsSync(weekDir)) {
    rmSync(weekDir, { recursive: true, force: true });
  }
}

/** Remove a synced data/<courseId>/<weekKey>/<section>/<topicId>/ folder. */
export function removeTopicFiles(courseId: string, weekKey: string, section: string, topicId: string) {
  const topicDir = join(DATA_DIR, courseId, weekKey, section, topicId);
  if (existsSync(topicDir)) {
    rmSync(topicDir, { recursive: true, force: true });
  }
}

/**
 * Sync all courses to files (run on shutdown/export)
 */
export async function syncAllToFiles(prisma: PrismaClient) {
  const courses = await prisma.course.findMany();
  for (const c of courses) {
    await syncCourseToFile(prisma, c.id);
  }
}

import { PrismaClient, Prisma } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { ImportPlan, PlannedCourse } from './importPlanner.js';
import { TRANSFER_LIMITS } from './transferLimits.js';
import { ArchiveError } from './archiveManifest.js';
import { invalidateRegistryCache } from '../utils/registryCache.js';

export interface ImportResult {
  imported: string[];
  skipped: string[];
}

function stringify(obj: unknown): string {
  return JSON.stringify(obj, null, 2);
}

function buildCatalogData(
  weeks: PlannedCourse['course']['weeks'],
  topics: PlannedCourse['course']['topics'],
) {
  const catalogObj: Record<
    string,
    {
      title: string;
      lectures: { id: string; title: string; description?: string }[];
      practice: { id: string; title: string; description?: string }[];
    }
  > = {};

  for (const week of weeks) {
    const weekTopics = topics.filter((t) => t.weekKey === week.weekKey);
    catalogObj[week.weekKey] = {
      title: week.title,
      lectures: weekTopics
        .filter((t) => !t.section || t.section === 'lectures' || t.section === 'topics')
        .map((t) => ({
          id: t.topicId,
          title: t.title ?? t.topicId,
          description: t.description,
        })),
      practice: weekTopics
        .filter((t) => t.section === 'practice')
        .map((t) => ({
          id: t.topicId,
          title: t.title ?? t.topicId,
          description: t.description,
        })),
    };
  }
  return catalogObj;
}

function stageSingleTopic(courseDir: string, topic: PlannedCourse['course']['topics'][number]): void {
  const topicDir = path.join(courseDir, topic.weekKey, topic.topicId);
  fs.mkdirSync(topicDir, { recursive: true });

  const topicMeta = {
    title: topic.title ?? topic.topicId,
    description: topic.description ?? '',
    position: topic.position ?? 0,
  };
  fs.writeFileSync(path.join(topicDir, 'topic.json'), stringify(topicMeta), 'utf8');

  if (topic.scene !== null && topic.scene !== undefined) {
    fs.writeFileSync(path.join(topicDir, 'scene.json'), stringify(topic.scene), 'utf8');
  }
  if (topic.model !== null && topic.model !== undefined) {
    fs.writeFileSync(path.join(topicDir, 'model.json'), stringify(topic.model), 'utf8');
  }
  if (topic.content !== null && topic.content !== undefined) {
    fs.writeFileSync(path.join(topicDir, 'content.json'), stringify(topic.content), 'utf8');
  }
}

function stageTopicFiles(courseDir: string, topics: PlannedCourse['course']['topics']): void {
  for (const topic of topics) {
    stageSingleTopic(courseDir, topic);
  }
}

function stageAssets(courseDir: string, assets: PlannedCourse['course']['assets']): void {
  if (!assets || assets.length === 0) return;
  const assetsDir = path.join(courseDir, 'assets');
  fs.mkdirSync(assetsDir, { recursive: true });
  for (const asset of assets) {
    const assetPath = path.join(assetsDir, asset.path);
    fs.mkdirSync(path.dirname(assetPath), { recursive: true });
    fs.writeFileSync(assetPath, Buffer.from(asset.content));
  }
}

function stageCourseFiles(stagingDir: string, course: PlannedCourse['course'], targetId: string): void {
  const courseDir = path.join(stagingDir, targetId);
  fs.mkdirSync(courseDir, { recursive: true });

  const courseMeta = { ...course.meta, id: targetId };
  fs.writeFileSync(path.join(courseDir, 'course.json'), stringify(courseMeta), 'utf8');

  const catalogObj = buildCatalogData(course.weeks, course.topics);
  fs.writeFileSync(path.join(courseDir, 'catalog.json'), stringify(catalogObj), 'utf8');
  fs.writeFileSync(path.join(courseDir, 'weeks.json'), stringify(course.weeks), 'utf8');

  stageTopicFiles(courseDir, course.topics);
  stageAssets(courseDir, course.assets);
}

async function cleanOldTopicDocs(tx: Prisma.TransactionClient, targetId: string): Promise<void> {
  const oldCourse = await tx.course.findUnique({
    where: { id: targetId },
    include: { weeks: { include: { topics: true } } },
  });
  const oldTopicIds = oldCourse?.weeks.flatMap((w) => w.topics.map((t) => t.topicId)) || [];

  await tx.course.delete({ where: { id: targetId } });

  if (oldTopicIds.length > 0 && 'canvasStoreDoc' in tx) {
    const docTx = tx as unknown as {
      canvasStoreDoc: { deleteMany: (args: unknown) => Promise<unknown> };
    };
    await docTx.canvasStoreDoc.deleteMany({
      where: { key: { in: oldTopicIds } },
    });
  }
}

function mapWeeksData(course: PlannedCourse['course']) {
  return course.weeks.map((week) => {
    const weekTopics = course.topics.filter((t) => t.weekKey === week.weekKey);
    return {
      weekKey: week.weekKey,
      title: week.title,
      topics: {
        create: weekTopics.map((topic, idx) => ({
          section: topic.section || 'topics',
          topicId: topic.topicId,
          position: typeof topic.position === 'number' ? topic.position : idx,
          title: topic.title ?? topic.topicId,
          description: topic.description ?? '',
          scene: topic.scene ? (topic.scene as Prisma.InputJsonValue) : Prisma.JsonNull,
          model: topic.model ? (topic.model as Prisma.InputJsonValue) : Prisma.JsonNull,
          content: topic.content ? (topic.content as Prisma.InputJsonValue) : Prisma.JsonNull,
        })),
      },
    };
  });
}

async function writeCourseToDatabase(
  tx: Prisma.TransactionClient,
  course: PlannedCourse['course'],
  targetId: string,
  action: PlannedCourse['action'],
): Promise<void> {
  if (action === 'replace') {
    await cleanOldTopicDocs(tx, targetId);
  }

  await tx.course.create({
    data: {
      id: targetId,
      code: String(course.meta.code ?? ''),
      title: String(course.meta.title ?? targetId),
      subtitle: String(course.meta.subtitle ?? ''),
      description: String(course.meta.description ?? ''),
      icon: String(course.meta.icon ?? 'BookOpen'),
      color: String(course.meta.color ?? 'var(--surface-1)'),
      accent: String(course.meta.accent ?? 'var(--text-1)'),
      badge: String(course.meta.badge ?? ''),
      weeks: {
        create: mapWeeksData(course),
      },
    },
  });
}

export async function applyImportPlan(
  prisma: PrismaClient,
  plan: ImportPlan,
  dataDir: string,
): Promise<ImportResult> {
  const stagingId = `.import-${crypto.randomUUID()}`;
  const stagingDir = path.join(dataDir, stagingId);
  fs.mkdirSync(stagingDir, { recursive: true });

  const activeCourses = plan.courses.filter((c) => c.action !== 'skip');
  const skipped = plan.courses.filter((c) => c.action === 'skip').map((c) => c.targetId);
  const imported: string[] = [];

  try {
    for (const planned of activeCourses) {
      stageCourseFiles(stagingDir, planned.course, planned.targetId);
    }

    await prisma.$transaction(
      async (tx) => {
        for (const planned of activeCourses) {
          await writeCourseToDatabase(tx, planned.course, planned.targetId, planned.action);
        }
      },
      { timeout: TRANSFER_LIMITS.transactionMs },
    );

    const oldBackupDir = path.join(stagingDir, '.old');
    fs.mkdirSync(oldBackupDir, { recursive: true });

    for (const planned of activeCourses) {
      const liveDir = path.join(dataDir, planned.targetId);
      const stagedCourseDir = path.join(stagingDir, planned.targetId);

      if (fs.existsSync(liveDir)) {
        const oldDir = path.join(oldBackupDir, planned.targetId);
        fs.renameSync(liveDir, oldDir);
      }
      fs.renameSync(stagedCourseDir, liveDir);
      imported.push(planned.targetId);
    }

    await invalidateRegistryCache();
    return { imported, skipped };
  } catch (error) {
    if (error instanceof ArchiveError) throw error;
    throw error;
  } finally {
    if (fs.existsSync(stagingDir)) {
      fs.rmSync(stagingDir, { recursive: true, force: true });
    }
  }
}

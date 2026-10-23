// Seed runner: mirrors data/ into SQLite, syncing add/edit/remove both ways.
// Rows with no matching file are deleted. The whole pass runs in one transaction
// (seedAtomically) so a failure partway rolls back every write.

import { PrismaClient, Prisma } from '@prisma/client';
import { join } from 'path';
import { pathToFileURL } from 'url';
import { dropEditorDoc } from '../server/utils/dropEditorDoc';
import { DATA_ROOT } from '../server/runtime/appPaths';
import { scanCourses, readWeekTitle, ScannedCourse, scanCourseTopics, ScannedTopic } from './catalogScanner';
import { loadTopicData, loadCatalogTopicMetadata, formatTopicTitle, formatTopicDescription } from './topicLoader';

const prisma = new PrismaClient();
// DATA_ROOT is the repo in a checkout and the OS app-data folder in the installed app, so the server's
// hot-reseed reads the same courses the user edits.
const DEFAULT_DATA_DIR = join(DATA_ROOT, 'data');
const isVerbose = process.env.VERBOSE === 'true' || process.argv.includes('--verbose');

function verboseLog(msg: string): void {
  if (isVerbose) console.log(msg);
}

// The subset of PrismaClient the seed logic needs.
type SeedClient = Pick<PrismaClient, 'course' | 'week' | 'topic' | 'canvasStoreDoc'> | Prisma.TransactionClient;

function shouldDropEditorDoc(existingScene: unknown, newScene: unknown): boolean {
  if (!newScene) return false;
  return JSON.stringify(existingScene ?? null) !== JSON.stringify(newScene);
}

async function seedCourse(db: SeedClient, course: ScannedCourse): Promise<void> {
  await db.course.upsert({ where: { id: course.id }, create: course, update: course });
  verboseLog(`  Course: ${course.id}`);
}

async function seedTopic(db: SeedClient, weekId: number, courseId: string, topic: ScannedTopic, dataDir: string): Promise<void> {
  const data = await loadTopicData(courseId, topic.weekKey, topic.section, topic.topicId, dataDir);
  const catalogMeta = loadCatalogTopicMetadata(courseId, topic.weekKey, topic.section, topic.topicId, dataDir);
  const payload = {
    title: catalogMeta?.title ?? formatTopicTitle(topic.topicId),
    description: catalogMeta?.description ?? formatTopicDescription(topic.topicId),
    scene: data.scene as object | undefined,
    model: data.model as object | undefined,
    content: data.content as object | undefined,
  };
  const where = { weekId_section_topicId: { weekId, section: topic.section, topicId: topic.topicId } };
  const existing = await db.topic.findUnique({ where });
  if (shouldDropEditorDoc(existing?.scene, data.scene)) {
    await dropEditorDoc(db, topic.topicId);
  }
  await db.topic.upsert({
    where,
    create: { weekId, section: topic.section, topicId: topic.topicId, position: await db.topic.count({ where: { weekId, section: topic.section } }), ...payload },
    update: payload,
  });
  verboseLog(`    Topic: ${topic.topicId}`);
}

async function seedCourseWeeksAndTopics(db: SeedClient, courseId: string, dataDir: string): Promise<void> {
  const topics = scanCourseTopics(courseId, dataDir);
  const weekKeys = [...new Set(topics.map((t) => t.weekKey))];

  for (const weekKey of weekKeys) {
    const title = readWeekTitle(courseId, weekKey, dataDir) ?? { en: weekKey };
    const week = await db.week.upsert({
      where: { courseId_weekKey: { courseId, weekKey } },
      create: { courseId, weekKey, title },
      update: { title },
    });
    verboseLog(`  Week: ${courseId}/${weekKey}`);
    for (const topic of topics.filter((t) => t.weekKey === weekKey)) {
      await seedTopic(db, week.id, courseId, topic, dataDir);
    }
  }
}

// Delete a week's topic rows when missing from data/.
async function pruneStaleTopics(
  db: SeedClient,
  courseId: string,
  week: { weekKey: string; topics: { id: number; section: string; topicId: string }[] },
  liveTopics: ReturnType<typeof scanCourseTopics>,
): Promise<void> {
  const liveTopicKeys = new Set(
    liveTopics.filter((t) => t.weekKey === week.weekKey).map((t) => `${t.section}/${t.topicId}`)
  );
  for (const topic of week.topics) {
    if (liveTopicKeys.has(`${topic.section}/${topic.topicId}`)) continue;
    await db.topic.delete({ where: { id: topic.id } });
    verboseLog(`  Removed topic: ${courseId}/${week.weekKey}/${topic.section}/${topic.topicId}`);
  }
}

// Delete DB rows when missing from data/.
async function pruneStale(db: SeedClient, courses: ScannedCourse[], dataDir: string): Promise<void> {
  const liveCourseIds = new Set(courses.map((c) => c.id));

  const dbCourses = await db.course.findMany({ include: { weeks: { include: { topics: true } } } });
  for (const course of dbCourses) {
    if (!liveCourseIds.has(course.id)) {
      await db.course.delete({ where: { id: course.id } });
      verboseLog(`  Removed course: ${course.id}`);
      continue;
    }

    const liveTopics = scanCourseTopics(course.id, dataDir);
    const liveWeekKeys = new Set(liveTopics.map((t) => t.weekKey));

    for (const week of course.weeks) {
      if (!liveWeekKeys.has(week.weekKey)) {
        await db.week.delete({ where: { id: week.id } });
        verboseLog(`  Removed week: ${course.id}/${week.weekKey}`);
        continue;
      }

      await pruneStaleTopics(db, course.id, week, liveTopics);
    }
  }
}

// Runs one full seed pass against db.
export async function runSeed(db: SeedClient, dataDir: string = DEFAULT_DATA_DIR): Promise<void> {
  const courses = scanCourses(dataDir);

  for (const course of courses) {
    await seedCourse(db, course);
    await seedCourseWeeksAndTopics(db, course.id, dataDir);
  }

  await pruneStale(db, courses, dataDir);
}

// Runs the full seed in one transaction.
export async function seedAtomically(client: PrismaClient = prisma): Promise<void> {
  await client.$transaction((tx) => runSeed(tx), { timeout: 30_000 });
}

async function main(): Promise<void> {
  await seedAtomically();
}

const isMainModule = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMainModule) {
  main()
    .catch((err) => { console.error('Seed failed:', err); process.exit(1); })
    .finally(() => prisma.$disconnect());
}

import { Prisma } from '@prisma/client';
import { buildManifest, ArchiveKind } from './archiveManifest.js';
import { buildCourseZip, CourseZipFile } from './buildCourseZip.js';

export type CourseWithTree = Prisma.CourseGetPayload<{
  include: { weeks: { include: { topics: true } } };
}>;

type TopicPayload = CourseWithTree['weeks'][number]['topics'][number];

function stringify(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function buildTopicFiles(weekKey: string, topic: TopicPayload): CourseZipFile[] {
  const files: CourseZipFile[] = [];
  const basePath = `${weekKey}/${topic.topicId}`;
  const topicMeta = {
    title: topic.title,
    description: topic.description,
    position: topic.position,
  };
  files.push({ path: `${basePath}/topic.json`, content: stringify(topicMeta) });

  if (topic.scene !== null && topic.scene !== undefined) {
    files.push({ path: `${basePath}/scene.json`, content: stringify(topic.scene) });
  }
  if (topic.model !== null && topic.model !== undefined) {
    files.push({ path: `${basePath}/model.json`, content: stringify(topic.model) });
  }
  if (topic.content !== null && topic.content !== undefined) {
    files.push({ path: `${basePath}/content.json`, content: stringify(topic.content) });
  }
  return files;
}

export function archiveFilesForCourse(
  course: CourseWithTree,
  options?: { packs?: { lang: string; content: string }[] },
): CourseZipFile[] {
  const courseMeta = {
    id: course.id,
    code: course.code,
    icon: course.icon,
    color: course.color,
    accent: course.accent,
    title: course.title,
    subtitle: course.subtitle,
    description: course.description,
    badge: course.badge,
  };

  const files: CourseZipFile[] = [
    { path: 'course.json', content: stringify(courseMeta) },
  ];

  const sortedWeeks = [...(course.weeks || [])].sort((a, b) => a.id - b.id);
  const weeksData = sortedWeeks.map((w, idx) => ({
    weekKey: w.weekKey,
    title: w.title,
    position: idx,
  }));
  files.push({ path: 'weeks.json', content: stringify(weeksData) });

  for (const week of sortedWeeks) {
    const sortedTopics = [...(week.topics || [])].sort((a, b) => a.position - b.position);
    for (const topic of sortedTopics) {
      files.push(...buildTopicFiles(week.weekKey, topic));
    }
  }

  if (options?.packs) {
    for (const pack of options.packs) {
      files.push({ path: `packs/${pack.lang}.json`, content: pack.content });
    }
  }

  return files;
}

export function buildArchive(
  courses: CourseWithTree[],
  kind: ArchiveKind,
  appVersion: string,
  coursePacks?: Record<string, { lang: string; content: string }[]>,
): Uint8Array {
  const ids = courses.map((c) => c.id);
  const manifest = buildManifest(ids, kind, appVersion);

  const allFiles: CourseZipFile[] = [
    { path: 'manifest.json', content: stringify(manifest) },
  ];

  for (const course of courses) {
    const packs = coursePacks?.[course.id];
    const courseFiles = archiveFilesForCourse(course, { packs });
    for (const file of courseFiles) {
      allFiles.push({
        path: `courses/${course.id}/${file.path}`,
        content: file.content,
      });
    }
  }

  return buildCourseZip(allFiles);
}

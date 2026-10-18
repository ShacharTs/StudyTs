/**
 * Low-complexity topic directory scanner.
 * Discovers week directories and lecture/practice topic folders on the filesystem.
 */

import { readdirSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * Discovers courses from data/<courseId>/course.json.
 * A course folder without course.json is not a real course (e.g. test fixtures) and is skipped.
 */


export interface LocalizedPair {
  en: string;
  [key: string]: string;
}

export interface ScannedCourse {
  id: string;
  code: string;
  title: LocalizedPair;
  subtitle: LocalizedPair;
  description: LocalizedPair;
  icon: string;
  color: string;
  accent: string;
  badge: LocalizedPair;
}

export function scanCourses(baseDataDir: string): ScannedCourse[] {
  if (!existsSync(baseDataDir)) return [];

  const entries = readdirSync(baseDataDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('_') && !entry.name.startsWith('.'));

  const courses: ScannedCourse[] = [];
  for (const entry of entries) {
    const coursePath = join(baseDataDir, entry.name, 'course.json');
    if (!existsSync(coursePath)) continue;
    try {
      const raw = readFileSync(coursePath, 'utf8');
      const parsed = JSON.parse(raw) as ScannedCourse;
      courses.push(parsed);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`  WARN: Could not parse course.json for ${entry.name}: ${message}`);
    }
  }
  return courses;
}

export function readWeekTitle(courseId: string, weekKey: string, baseDataDir: string): LocalizedPair | null {
  const catalogPath = join(baseDataDir, courseId, 'catalog.json');
  if (!existsSync(catalogPath)) return null;
  try {
    const catalog = JSON.parse(readFileSync(catalogPath, 'utf8')) as Record<string, { title?: LocalizedPair }>;
    return catalog[weekKey]?.title ?? null;
  } catch {
    return null;
  }
}

export const SCANNER_CONSTANTS = {
  WEEK_PREFIX: 'week',
  SECTIONS: ['lectures', 'practice'] as const,
} as const;

export type SectionType = (typeof SCANNER_CONSTANTS.SECTIONS)[number];

export interface ScannedTopic {
  weekKey: string;
  section: SectionType;
  topicId: string;
}

function getSubdirectories(directoryPath: string): string[] {
  if (!existsSync(directoryPath)) return [];
  return readdirSync(directoryPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

function scanSectionTopics(
  weekDir: string,
  weekKey: string,
  section: SectionType
): ScannedTopic[] {
  const sectionDir = join(weekDir, section);
  const topicFolderNames = getSubdirectories(sectionDir).filter(
    (name) => !name.startsWith('_') && !name.startsWith('.')
  );
  return topicFolderNames.map((topicId) => ({
    weekKey,
    section,
    topicId,
  }));
}

function scanWeekTopics(courseDir: string, weekKey: string): ScannedTopic[] {
  const weekDir = join(courseDir, weekKey);
  const detectedSubdirs = getSubdirectories(weekDir);
  const validSections = detectedSubdirs.filter(
    (name): name is SectionType => SCANNER_CONSTANTS.SECTIONS.includes(name as SectionType)
  );

  return validSections.flatMap((section) =>
    scanSectionTopics(weekDir, weekKey, section)
  );
}

export function scanCourseTopics(courseId: string, baseDataDir: string): ScannedTopic[] {
  const courseDir = join(baseDataDir, courseId);
  const detectedSubdirs = getSubdirectories(courseDir);
  const weekFolderNames = detectedSubdirs.filter((name) => {
    if (name.startsWith('_') || name.startsWith('.')) return false;
    const sub = getSubdirectories(join(courseDir, name));
    return sub.some((s) => SCANNER_CONSTANTS.SECTIONS.includes(s as SectionType));
  });

  return weekFolderNames.flatMap((weekKey) =>
    scanWeekTopics(courseDir, weekKey)
  );
}

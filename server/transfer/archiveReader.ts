import { unzipSync, strFromU8 } from 'fflate';
import {
  ArchiveError,
  parseManifest,
  buildManifest,
  type ArchiveManifest,
} from './archiveManifest.js';
import { TRANSFER_LIMITS, COURSE_ID_PATTERN } from './transferLimits.js';
import { collectCourseMetaProblems } from './courseMetaValidation.js';
import { validateBlocks } from '../../src/core/validation/blocks/index.js';

const SEGMENT_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const TOPIC_FILE_FLAT_RE = /^([^/]+)\/([^/]+)\/(topic|scene|model|content)\.json$/;
const TOPIC_FILE_SECTION_RE = /^([^/]+)\/([^/]+)\/([^/]+)\/(topic|scene|model|content)\.json$/;
const COURSE_PREFIX = 'courses/';
const ASSETS_SUBDIR = 'assets/';
const PACKS_SUBDIR = 'packs/';

export interface ArchiveTopic {
  weekKey: string;
  topicId: string;
  section?: string;
  title?: string;
  description?: string;
  position?: number;
  scene?: unknown;
  model?: unknown;
  content?: unknown;
}

export interface ArchiveCourse {
  meta: Record<string, unknown> & {
    id: string;
    title: string;
    subtitle?: string;
    description?: string;
    badge?: string;
  };
  weeks: { weekKey: string; title: string; position: number }[];
  topics: ArchiveTopic[];
  assets: { path: string; content: Uint8Array }[];
  packs?: { path: string; content: string }[];
}

export interface ParsedArchive {
  manifest: ArchiveManifest;
  courses: ArchiveCourse[];
}

export function assertSafeEntryPath(path: string): void {
  const bad =
    path.includes('\\') ||
    path.startsWith('/') ||
    path.includes('\0') ||
    /^[A-Za-z]:/.test(path);
  const segments = path
    .split('/')
    .filter((s, i, all) => !(s === '' && i === all.length - 1));
  const traversal = segments.some(
    (s) => s === '..' || s === '.' || s === '' || s.includes(':'),
  );
  if (bad || traversal) {
    throw new ArchiveError('unsafe_path', `Unsafe path in archive: ${path}`);
  }
}

function inflateEntries(bytes: Uint8Array): Record<string, Uint8Array> {
  if (bytes.byteLength > TRANSFER_LIMITS.maxCompressedBytes) {
    throw new ArchiveError('too_large', 'Archive file is too large', 413);
  }
  let count = 0;
  let total = 0;
  try {
    return unzipSync(bytes, {
      filter: (file) => {
        assertSafeEntryPath(file.name);
        if (++count > TRANSFER_LIMITS.maxEntries) {
          throw new ArchiveError('too_many_entries', 'Archive has too many entries');
        }
        total += file.originalSize;
        if (
          file.originalSize > TRANSFER_LIMITS.maxEntryBytes ||
          total > TRANSFER_LIMITS.maxTotalBytes
        ) {
          throw new ArchiveError('too_large', 'Archive decompressed size exceeds the limit', 413);
        }
        return true;
      },
    });
  } catch (error) {
    if (error instanceof ArchiveError) throw error;
    throw new ArchiveError('corrupt', 'File is not a valid zip archive');
  }
}

function parseJsonEntry(bytes: Uint8Array, path: string): unknown {
  try {
    return JSON.parse(strFromU8(bytes));
  } catch {
    throw new ArchiveError('corrupt', `'${path}' is not valid JSON`);
  }
}

interface PathCoords {
  weekKey: string;
  section: string;
  topicId: string;
  fileType: string;
}

function isSafeCoord(s: string): boolean {
  return SEGMENT_RE.test(s) && !s.includes('..');
}

function parsePathCoords(path: string, courseId: string): PathCoords | null {
  const flatMatch = TOPIC_FILE_FLAT_RE.exec(path);
  const sectionMatch = TOPIC_FILE_SECTION_RE.exec(path);

  if (!flatMatch && !sectionMatch) return null;

  const coords: PathCoords = flatMatch
    ? { weekKey: flatMatch[1], section: 'topics', topicId: flatMatch[2], fileType: flatMatch[3] }
    : { weekKey: sectionMatch![1], section: sectionMatch![2], topicId: sectionMatch![3], fileType: sectionMatch![4] };

  if (!isSafeCoord(coords.weekKey) || !isSafeCoord(coords.topicId) || !isSafeCoord(coords.section)) {
    throw new ArchiveError('unsafe_path', `Unsafe topic path in course '${courseId}': ${path}`);
  }

  return coords;
}

function applyTopicMeta(topic: ArchiveTopic, parsed: unknown): void {
  const tObj = parsed as Record<string, unknown>;
  topic.title = typeof tObj.title === 'string' ? tObj.title : (tObj.title as string | undefined);
  topic.description =
    typeof tObj.description === 'string'
      ? tObj.description
      : (tObj.description as string | undefined);
  if (typeof tObj.position === 'number') topic.position = tObj.position;
}

function applySceneData(topic: ArchiveTopic, parsed: unknown, courseId: string, path: string): void {
  if (parsed && typeof parsed === 'object' && Array.isArray((parsed as Record<string, unknown>).blocks)) {
    const p = parsed as { blocks: unknown[]; nodes?: Record<string, unknown> };
    const err = validateBlocks(p.blocks, p.nodes);
    if (err) {
      throw new ArchiveError('invalid_course', `Course '${courseId}' scene '${path}' invalid: ${err}`);
    }
  }
  topic.scene = parsed;
}

function applyTopicPayload(
  topic: ArchiveTopic,
  fileType: string,
  parsed: unknown,
  courseId: string,
  path: string,
): void {
  if (fileType === 'topic') applyTopicMeta(topic, parsed);
  else if (fileType === 'scene') applySceneData(topic, parsed, courseId, path);
  else if (fileType === 'model') topic.model = parsed;
  else if (fileType === 'content') topic.content = parsed;
}

function parseTopicsAndAssets(
  scoped: Record<string, Uint8Array>,
  courseId: string,
): {
  topics: ArchiveTopic[];
  assets: { path: string; content: Uint8Array }[];
  packs: { path: string; content: string }[];
} {
  const topicMap = new Map<string, ArchiveTopic>();
  const assets: { path: string; content: Uint8Array }[] = [];
  const packs: { path: string; content: string }[] = [];

  for (const [path, bytes] of Object.entries(scoped)) {
    if (path === 'course.json' || path === 'weeks.json' || path === 'catalog.json') continue;
    if (path.startsWith(ASSETS_SUBDIR)) {
      assets.push({ path: path.slice(ASSETS_SUBDIR.length), content: bytes });
      continue;
    }
    if (path.startsWith(PACKS_SUBDIR)) {
      packs.push({ path: path.slice(PACKS_SUBDIR.length), content: strFromU8(bytes) });
      continue;
    }

    const coords = parsePathCoords(path, courseId);
    if (!coords) continue;

    const key = `${coords.weekKey}/${coords.topicId}`;
    let topic = topicMap.get(key);
    if (!topic) {
      topic = { weekKey: coords.weekKey, topicId: coords.topicId, section: coords.section };
      topicMap.set(key, topic);
    }

    const parsed = parseJsonEntry(bytes, path);
    applyTopicPayload(topic, coords.fileType, parsed, courseId, path);
  }

  return { topics: Array.from(topicMap.values()), assets, packs };
}

function parseWeeks(
  scoped: Record<string, Uint8Array>,
  topics: ArchiveTopic[],
): { weekKey: string; title: string; position: number }[] {
  if (scoped['weeks.json']) {
    const raw = parseJsonEntry(scoped['weeks.json'], 'weeks.json');
    if (Array.isArray(raw)) {
      return raw.map((w, idx) => ({
        weekKey: String(w.weekKey ?? `week-${idx + 1}`),
        title: typeof w.title === 'string' ? w.title : String(w.title ?? w.weekKey),
        position: typeof w.position === 'number' ? w.position : idx,
      }));
    }
  }

  const weekKeys = Array.from(new Set(topics.map((t) => t.weekKey))).sort();
  return weekKeys.map((weekKey, idx) => ({
    weekKey,
    title: weekKey,
    position: idx,
  }));
}

function readCourse(id: string, scoped: Record<string, Uint8Array>): ArchiveCourse {
  const courseBytes = scoped['course.json'];
  if (!courseBytes) {
    throw new ArchiveError('invalid_course', `Missing 'course.json' for course '${id}'`);
  }
  const candidate = parseJsonEntry(courseBytes, `courses/${id}/course.json`);
  const problems = collectCourseMetaProblems(candidate);
  if (problems.length > 0) {
    throw new ArchiveError('invalid_course', `Invalid course.json in course '${id}':\n${problems.join('\n')}`);
  }
  const meta = candidate as ArchiveCourse['meta'];
  if (meta.id !== id) {
    throw new ArchiveError(
      'invalid_course',
      `Course ID '${meta.id}' does not match directory name '${id}'`,
    );
  }
  if (!COURSE_ID_PATTERN.test(meta.id)) {
    throw new ArchiveError('invalid_course', `Course ID '${meta.id}' is invalid`);
  }

  const { topics, assets, packs } = parseTopicsAndAssets(scoped, id);
  const weeks = parseWeeks(scoped, topics);

  return { meta, weeks, topics, assets, packs };
}

function readModernCourses(entries: Record<string, Uint8Array>, manifest: ArchiveManifest): ArchiveCourse[] {
  if (manifest.courses.length === 0) {
    throw new ArchiveError('invalid_manifest', 'Archive manifest lists no courses');
  }
  if (manifest.courses.length > TRANSFER_LIMITS.maxCourses) {
    throw new ArchiveError('too_many_entries', `Archive exceeds max courses limit of ${TRANSFER_LIMITS.maxCourses}`);
  }

  return manifest.courses.map((courseRef) => {
    const prefix = `${COURSE_PREFIX}${courseRef.id}/`;
    const scoped: Record<string, Uint8Array> = {};
    for (const [k, v] of Object.entries(entries)) {
      if (k.startsWith(prefix)) scoped[k.slice(prefix.length)] = v;
    }
    if (Object.keys(scoped).length === 0) {
      throw new ArchiveError('invalid_course', `Course folder missing for listed course '${courseRef.id}'`);
    }
    return readCourse(courseRef.id, scoped);
  });
}

export function readArchive(bytes: Uint8Array): ParsedArchive {
  const entries = inflateEntries(bytes);
  const keys = Object.keys(entries);
  if (keys.length === 0) throw new ArchiveError('corrupt', 'Archive is empty');

  if (entries['manifest.json']) {
    const manifestRaw = parseJsonEntry(entries['manifest.json'], 'manifest.json');
    const manifest = parseManifest(manifestRaw);
    const courses = readModernCourses(entries, manifest);
    return { manifest, courses };
  }

  // Legacy single course zip (no manifest.json, root course.json)
  if (!entries['course.json']) {
    throw new ArchiveError('corrupt', "Archive missing 'manifest.json' or root 'course.json'");
  }
  const candidate = parseJsonEntry(entries['course.json'], 'course.json');
  const problems = collectCourseMetaProblems(candidate);
  if (problems.length > 0) {
    throw new ArchiveError('invalid_course', `Legacy course.json is invalid:\n${problems.join('\n')}`);
  }
  const meta = candidate as { id: string };
  if (!COURSE_ID_PATTERN.test(meta.id)) {
    throw new ArchiveError('invalid_course', `Legacy course id '${meta.id}' is invalid`);
  }

  const manifest = buildManifest([meta.id], 'course', 'legacy');
  const course = readCourse(meta.id, entries);
  return { manifest, courses: [course] };
}

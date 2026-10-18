import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { validateCatalogJson, validateSceneJson } from '../../../src/core/validation/topicJsonSchema.js';
import { validateBlocks } from '../../../src/core/validation/blocks/validateBlocks.js';
import { checkVisualSpecForPublish } from '../../../src/core/validation/visualSpec/visualSpecPublishCheck.js';
import { compileTopology } from '../../../src/core/canvasBlocks/compileTopology.js';

type Args = Record<string, unknown>;
type Localized = { en: string } & Record<string, string>;
type CatalogEntry = { id: string; title: Localized; description: Localized };
type CatalogWeek = { title: Localized; lectures: CatalogEntry[]; practice: CatalogEntry[] };
type Catalog = Record<string, CatalogWeek>;

// Lowercase kebab only: this is what keeps every path the tools build inside data/.
const SEGMENT = /^[a-z0-9][a-z0-9-]{0,63}$/;
const SECTIONS = ['lectures', 'practice'];
const CONTENT_FIELDS = ['title', 'concept', 'whatChanged', 'why'];
const COURSE_DEFAULTS = { icon: 'BookOpen', color: 'rgba(99, 102, 241, 0.15)', accent: '#6366f1', badge: 'Course', subtitle: '' };

function segment(label: string, value: unknown): string {
  if (typeof value !== 'string' || !SEGMENT.test(value)) {
    throw new Error(`${label} must be lowercase letters, digits and hyphens, got ${JSON.stringify(value)}`);
  }
  return value;
}

function sectionOf(value: unknown): string {
  const section = value ?? 'lectures';
  if (typeof section !== 'string' || !SECTIONS.includes(section)) throw new Error("section must be 'lectures' or 'practice'");
  return section;
}

function localized(label: string, value: unknown): Localized {
  if (typeof value === 'string' && value.trim()) return { en: value };
  const record = value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  const texts = Object.entries(record).filter((entry): entry is [string, string] => typeof entry[1] === 'string');
  if (typeof record.en !== 'string') throw new Error(`${label} must be a non-empty string or an object with an en text`);
  return { ...Object.fromEntries(texts), en: record.en };
}

function missingContentField(step: unknown): string | undefined {
  const record = (step ?? {}) as Record<string, unknown>;
  return CONTENT_FIELDS.find((field) => typeof record[field] !== 'string' || !(record[field] as string).trim());
}

function assertContent(content: unknown): void {
  if (!Array.isArray(content) || content.length === 0) throw new Error('content must be a non-empty array of steps');
  const bad = content.findIndex((step) => missingContentField(step));
  if (bad >= 0) throw new Error(`content[${bad}] is missing a non-empty "${missingContentField(content[bad])}"`);
}

function sceneWithId(scene: unknown, fallbackId: string): unknown {
  if (scene && typeof scene === 'object' && !Array.isArray(scene) && !('id' in scene)) return { ...scene, id: fallbackId };
  return scene;
}

/** The graph block for a compiled topology: the caller's id and position, else a fresh id placed under the existing blocks. */
function networkBlock(args: Args, compiled: Exclude<ReturnType<typeof compileTopology>, { error: string }>, blocks: Array<{ y?: number; height?: number }>) {
  const below = Math.max(0, ...blocks.map((b) => (b.y ?? 0) + (b.height ?? 0)));
  return {
    id: typeof args.blockId === 'string' && args.blockId ? args.blockId : `network-${Date.now()}`,
    kind: 'graph' as const,
    x: typeof args.x === 'number' ? args.x : 40,
    y: typeof args.y === 'number' ? args.y : below > 0 ? below + 40 : 40,
    width: compiled.width,
    height: compiled.height,
    state: compiled.state,
  };
}

/** The course-authoring tools, bound to a data folder (injectable so tests can use a temp dir). */
export function createCourseAuthorTools(dataDir: string) {
  const courseDir = (courseId: string) => path.join(dataDir, courseId);
  const relative = (file: string) => path.relative(dataDir, file).split(path.sep).join('/');

  async function writeJson(file: string, value: unknown): Promise<void> {
    await fs.mkdir(path.dirname(file), { recursive: true });
    // Write to a .tmp sibling first: the data/ watcher ignores .tmp, so it never reseeds a half-written file.
    const tmp = `${file}.tmp`;
    await fs.writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, 'utf-8');
    await fs.rename(tmp, file);
  }

  function requireCourse(courseId: string): string {
    const dir = courseDir(courseId);
    if (!fsSync.existsSync(path.join(dir, 'course.json'))) {
      throw new Error(`Course '${courseId}' does not exist; create it with create_course first`);
    }
    return dir;
  }

  async function readCatalog(dir: string): Promise<Catalog> {
    const file = path.join(dir, 'catalog.json');
    if (!fsSync.existsSync(file)) return {};
    return JSON.parse(await fs.readFile(file, 'utf-8')) as Catalog;
  }

  async function listCourses() {
    const entries = await fs.readdir(dataDir, { withFileTypes: true });
    const courses = [];
    for (const entry of entries) {
      if (!entry.isDirectory() || !fsSync.existsSync(path.join(courseDir(entry.name), 'course.json'))) continue;
      const catalog = await readCatalog(courseDir(entry.name));
      const weeks = Object.fromEntries(Object.entries(catalog).map(([key, week]) => [key, week.lectures.map((l) => l.id)]));
      courses.push({ id: entry.name, weeks });
    }
    return { courses };
  }

  async function createCourse(args: Args) {
    const id = segment('id', args.id);
    const file = path.join(courseDir(id), 'course.json');
    if (fsSync.existsSync(file)) throw new Error(`Course '${id}' already exists`);
    const fields = { code: id.toUpperCase(), description: '', ...COURSE_DEFAULTS };
    const course = { id, title: String(args.title ?? ''), ...fields };
    for (const key of Object.keys(fields) as (keyof typeof fields)[]) {
      if (args[key] !== undefined) course[key] = String(args[key]);
    }
    if (!course.title.trim()) throw new Error('title is required');
    await writeJson(file, course);
    return { written: [relative(file)] };
  }

  async function writeLecture(args: Args) {
    const dir = requireCourse(segment('courseId', args.courseId));
    const topicId = segment('topicId', args.topicId);
    const topicDir = path.join(dir, segment('weekKey', args.weekKey), sectionOf(args.section), topicId);
    if (args.content === undefined && args.scene === undefined) throw new Error('Provide content, scene, or both');

    const written: string[] = [];
    if (args.content !== undefined) {
      assertContent(args.content);
      await writeJson(path.join(topicDir, 'content.json'), args.content);
      written.push(relative(path.join(topicDir, 'content.json')));
    }
    if (args.scene !== undefined) {
      const scene = sceneWithId(args.scene, topicId);
      const check = validateSceneJson(scene);
      if (!check.valid) throw new Error(`Invalid scene: ${check.error}`);
      await writeJson(path.join(topicDir, 'scene.json'), scene);
      written.push(relative(path.join(topicDir, 'scene.json')));
    }
    return { written, next: 'Call add_lecture_to_course_list so the lecture gets a proper title and description, then confirm with mcp__studyts-mcp__list_lectures (the database follows about a second after the files while the app server runs).' };
  }

  async function writeVisualLecture(args: Args) {
    const dir = requireCourse(segment('courseId', args.courseId));
    const topicDir = path.join(dir, segment('weekKey', args.weekKey), sectionOf(args.section), segment('topicId', args.topicId));
    const checked = checkVisualSpecForPublish(args.spec);
    if (!checked.spec || checked.problems.length > 0) throw new Error(`Invalid visual lecture: ${checked.problems.join('; ')}`);
    const file = path.join(topicDir, 'model.json');
    await writeJson(file, checked.spec);
    return { written: [relative(file)], next: 'Call add_lecture_to_course_list so the lecture gets a proper title and description, then confirm with mcp__studyts-mcp__list_lectures.' };
  }

  async function updateCatalog(args: Args) {
    const dir = requireCourse(segment('courseId', args.courseId));
    const weekKey = segment('weekKey', args.weekKey);
    const section = sectionOf(args.section) as 'lectures' | 'practice';
    const lecture = (args.lecture ?? {}) as Args;
    const entry: CatalogEntry = {
      id: segment('lecture.id', lecture.id),
      title: localized('lecture.title', lecture.title),
      description: localized('lecture.description', lecture.description),
    };

    const catalog = await readCatalog(dir);
    const week = catalog[weekKey] ?? { title: localized('weekTitle', args.weekTitle), lectures: [], practice: [] };
    if (args.weekTitle !== undefined) week.title = localized('weekTitle', args.weekTitle);
    week[section] = [...week[section].filter((e) => e.id !== entry.id), entry];
    catalog[weekKey] = week;

    const check = validateCatalogJson(catalog);
    if (!check.valid) throw new Error(`Invalid catalog: ${check.error}`);
    const file = path.join(dir, 'catalog.json');
    await writeJson(file, catalog);
    return { written: [relative(file)], next: 'Confirm with mcp__studyts-mcp__list_lectures that the lecture appears; the database follows about a second later.' };
  }

  /** Adds one network diagram (devices, links, zones) as a graph block under the existing blocks of a lecture's scene. */
  async function addNetworkDiagram(args: Args) {
    const dir = requireCourse(segment('courseId', args.courseId));
    const topicId = segment('topicId', args.topicId);
    const sceneFile = path.join(dir, segment('weekKey', args.weekKey), sectionOf(args.section), topicId, 'scene.json');
    const compiled = compileTopology(args.topology);
    if ('error' in compiled) throw new Error(compiled.error);

    const scene = (fsSync.existsSync(sceneFile) ? JSON.parse(await fs.readFile(sceneFile, 'utf-8')) : { id: topicId, blocks: [] }) as { blocks?: Array<{ y?: number; height?: number }> };
    const blocks = Array.isArray(scene.blocks) ? scene.blocks : [];
    const block = networkBlock(args, compiled, blocks);
    const invalid = validateBlocks([block as never]);
    if (invalid) throw new Error(`Compiled diagram failed validation: ${invalid}`);

    const next = sceneWithId({ ...scene, blocks: [...blocks, block] }, topicId);
    const check = validateSceneJson(next);
    if (!check.valid) throw new Error(`Invalid scene: ${check.error}`);
    await writeJson(sceneFile, next);
    return { written: [relative(sceneFile)], devices: compiled.state.nodes.length, links: compiled.state.edges.length, merged: compiled.merged };
  }

  return { listCourses, createCourse, writeLecture, writeVisualLecture, updateCatalog, addNetworkDiagram };
}

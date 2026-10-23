import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { validateCatalogJson, validateSceneJson } from '../../../src/core/validation/topicJsonSchema.js';
import { validateBlocks } from '../../../src/core/validation/blocks/validateBlocks.js';
import { checkVisualSpecForPublish } from '../../../src/core/validation/visualSpec/visualSpecPublishCheck.js';
import { checkVisualSpec } from '../../../src/core/validation/visualSpec/visualSpecJson.js';
import { compileStoryboard } from '../../../src/core/storyboard/compileStoryboard.js';
import { finalizeBuilderSpec } from '../../../src/core/visualBuilder/builderFinalize.js';
import { visualLectureInputProblems, withDefaultTweens } from './visualLectureInput.js';
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

/** The course-authoring tools, bound to a data folder (injectable so tests can use a temp dir).
 *  Every result carries the absolute dataDir, so a caller can see which copy of StudyTs it wrote to. */
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
    return { dataDir, courses };
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
    return { dataDir, written: [relative(file)] };
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
    return { dataDir, written, next: 'Call add_lecture_to_course_list so the lecture gets a proper title and description, then confirm with mcp__studyts-mcp__list_lectures (the database follows about a second after the files while the app server runs).' };
  }

  /** The spec to save: a storyboard goes through the app's own compiler (layout, arrows, blocks, bubbles); a raw spec is checked and finalized like a step maker edit. */
  function lectureSpec(args: Args): unknown {
    if (args.storyboard !== undefined) {
      const compiled = compileStoryboard(args.storyboard);
      if (!compiled.spec) throw new Error(`Invalid storyboard: ${compiled.problems.join('; ')}`);
      return compiled.spec;
    }
    if (args.spec === undefined) throw new Error('Give a storyboard (preferred) or a spec');
    const parsed = checkVisualSpec(withDefaultTweens(args.spec));
    const input = parsed.spec ? visualLectureInputProblems(parsed.spec) : [];
    if (!parsed.spec || parsed.problems.length + input.length > 0) throw new Error(`Invalid visual lecture: ${[...parsed.problems, ...input].join('; ')}`);
    // The step maker edits builder.blocks and regenerates tweens from them, so the saved spec gets the same tweens the maker would write.
    return finalizeBuilderSpec(parsed.spec);
  }

  async function writeVisualLecture(args: Args) {
    const dir = requireCourse(segment('courseId', args.courseId));
    const topicDir = path.join(dir, segment('weekKey', args.weekKey), sectionOf(args.section), segment('topicId', args.topicId));
    const checked = checkVisualSpecForPublish(lectureSpec(args));
    if (!checked.spec || checked.problems.length > 0) throw new Error(`Invalid visual lecture: ${checked.problems.join('; ')}`);
    const file = path.join(topicDir, 'model.json');
    await writeJson(file, checked.spec);
    const blocks = checked.spec.steps.reduce((total, step) => total + (step.builder?.blocks?.length ?? 0), 0);
    const stats = { steps: checked.spec.steps.length, elements: checked.spec.elements.length, blocks, editable: blocks > 0 };
    if (args.title === undefined) return { dataDir, written: [relative(file)], ...stats, next: 'Call add_lecture_to_course_list so the lecture gets a proper title and description, then confirm with mcp__studyts-mcp__list_lectures.' };
    const listed = await listInCatalog(args, dir);
    return { dataDir, written: [relative(file), listed], ...stats, next: 'Confirm with mcp__studyts-mcp__list_lectures.' };
  }

  /** One call instead of two: a title on a saved lecture lists it in the course. A new week gets its key as a title unless weekTitle is given. */
  async function listInCatalog(args: Args, dir: string): Promise<string> {
    const weekKey = segment('weekKey', args.weekKey);
    const known = Boolean((await readCatalog(dir))[weekKey]);
    const weekTitle = args.weekTitle ?? (known ? undefined : weekKey.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase()));
    const lecture = { id: args.topicId, title: args.title, description: args.description ?? args.title };
    const done = await updateCatalog({ courseId: args.courseId, weekKey, section: args.section, weekTitle, lecture });
    return done.written[0];
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
    return { dataDir, written: [relative(file)], next: 'Confirm with mcp__studyts-mcp__list_lectures that the lecture appears; the database follows about a second later.' };
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
    return { dataDir, written: [relative(sceneFile)], devices: compiled.state.nodes.length, links: compiled.state.edges.length, merged: compiled.merged };
  }

  return { listCourses, createCourse, writeLecture, writeVisualLecture, updateCatalog, addNetworkDiagram };
}

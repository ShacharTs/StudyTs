import type { TopicAttachment } from './shared/topicAttachment';
/**
 * Dynamic module loader for topic content.
 * Fetches from backend API instead of import.meta.glob (fixes P9 — no HMR reload).
 */

import { VizStep, VisualizationState } from './types/visualizationState';
import { CanvasScene } from './types/canvasScene';
import type { LocalizedValue } from '../i18n/localizedValue';
import type { VisualSpec } from './types/visualSpec';
import { API_PATHS } from './shared/apiPaths';

export type TopicContent =
  | { type: 'steps'; id: string; title: string | LocalizedValue; steps: VizStep<VisualizationState>[] }
  | { type: 'canvas'; id: string; title: string | LocalizedValue; scene: CanvasScene }
  | { type: 'visual'; id: string; title: string | LocalizedValue; spec: VisualSpec }
  | { type: 'file'; id: string; title: string | LocalizedValue; attachments: TopicAttachment[] };

// Lightweight catalog type (matches API response shape)
export interface TopicCatalogEntry {
  id: string;
  title: string | LocalizedValue;
  description: string | LocalizedValue;
  contentUrl: string;
  /** Which viewer the topic opens: the canvas editor or the step player. Absent for older data. */
  kind?: 'canvas' | 'stepPlayer' | 'file';
  /** Lecture documents attached to the topic. Absent for topics without any. */
  attachments?: TopicAttachment[];
}

export interface WeekCatalogAPI {
  title: string | LocalizedValue;
  lectures: TopicCatalogEntry[];
  practice: TopicCatalogEntry[];
}

export interface CourseDefinitionAPI {
  id: string;
  code: string;
  title: string | LocalizedValue;
  subtitle: string | LocalizedValue;
  description: string | LocalizedValue;
  icon: string;
  color: string;
  accent: string;
  badge: string | LocalizedValue;
  textColor?: string;
  catalog: Record<string, WeekCatalogAPI>;
}

let cachedRegistry: Record<string, CourseDefinitionAPI> | null = null;

/**
 * Fetch the full course catalog from the backend API.
 * Cached after first fetch — call `clearRegistryCache()` to refresh.
 */
export async function fetchRegistry(): Promise<Record<string, CourseDefinitionAPI>> {
  if (cachedRegistry) return cachedRegistry;

  const res = await fetch(API_PATHS.registry);
  if (!res.ok) throw new Error(`Failed to fetch registry: ${res.status}`);

  const data: Record<string, CourseDefinitionAPI> = await res.json();
  cachedRegistry = data;
  return data;
}

export function clearRegistryCache(): void {
  cachedRegistry = null;
}

/**
 * Locate a topic entry across the full registry or within a specific course.
 */
function findTopic(
  registry: Record<string, CourseDefinitionAPI>,
  topicId: string,
  courseId?: string,
): TopicCatalogEntry | undefined {
  const courses = courseId && registry[courseId] ? [registry[courseId]] : Object.values(registry);

  for (const course of courses) {
    for (const week of Object.values(course.catalog)) {
      const match = [...week.lectures, ...week.practice].find((t) => t.id === topicId);
      if (match) return match;
    }
  }
  return undefined;
}

/** Which week and section of a course a topic sits in (needed to address it for editing). */
export function findTopicLocation(
  registry: Record<string, CourseDefinitionAPI>,
  courseId: string,
  topicId: string,
): { weekKey: string; section: 'lectures' | 'practice' } | null {
  for (const [weekKey, week] of Object.entries(registry[courseId]?.catalog ?? {})) {
    if (week.lectures.some((topic) => topic.id === topicId)) return { weekKey, section: 'lectures' };
    if (week.practice.some((topic) => topic.id === topicId)) return { weekKey, section: 'practice' };
  }
  return null;
}

function readSteps(model: unknown): VizStep<VisualizationState>[] {
  if (Array.isArray(model)) return model;
  const steps = (model as { steps?: unknown } | null | undefined)?.steps;
  return Array.isArray(steps) ? steps : [];
}

function isVisualSpec(model: unknown): model is VisualSpec {
  return (
    !!model &&
    typeof model === 'object' &&
    'viewBox' in model &&
    'elements' in model &&
    'steps' in model &&
    Array.isArray((model as VisualSpec).elements) &&
    Array.isArray((model as VisualSpec).steps)
  );
}

/**
 * Loads topic content from the backend API.
 * Replaces the old import.meta.glob-based loader.
 */
export async function loadTopicContent(
  topicId: string,
  courseId?: string,
): Promise<TopicContent> {
  const foundTopic = findTopic(await fetchRegistry(), topicId, courseId);
  if (!foundTopic) throw new Error(`Topic not found: ${topicId}`);

  const res = await fetch(foundTopic.contentUrl);
  if (!res.ok) throw new Error(`Failed to load content for ${topicId}: ${res.status}`);
  const data = await res.json();

  if (data.scene) return { type: 'canvas', id: data.id, title: foundTopic.title, scene: data.scene as CanvasScene };
  if (Array.isArray(data.attachments)) {
    return { type: 'file', id: data.id, title: foundTopic.title, attachments: data.attachments as TopicAttachment[] };
  }
  const model = data.model;
  if (isVisualSpec(model)) {
    return { type: 'visual', id: data.id, title: foundTopic.title, spec: model };
  }
  return { type: 'steps', id: data.id, title: foundTopic.title, steps: readSteps(model) };
}

/**
 * Client-side parameter validation, sanitization, and auto-normalization
 * for content editor tools.
 *
 * Automatically normalizes slugs, color codes, Lucide icons, localized strings,
 * and resolves casing mismatches against the live COURSE_REGISTRY before
 * dispatching API requests.
 *
 * Implementation split by concern: paramNormalizers.ts (shared normalization
 * primitives), courseParamValidator.ts, weekTopicParamValidators.ts
 * (per-entity validators). This file is the public barrel plus the
 * top-level dispatcher.
 */

import {
  normalizeLocalized,
  normalizeSlug,
  normalizeColor,
  normalizeIcon,
  resolveCourseId,
  asArgs,
  readAction,
  resolveWeekKey,
  type ToolParamValidationResult,
} from './paramNormalizers';

/**
 * Validates and sanitizes parameters for content_editor_week tool.
 */
export function validateWeekParams(
  args: Record<string, unknown>,
  registry?: Record<string, { catalog?: Record<string, unknown> }>
): ToolParamValidationResult {
  const safeArgs = asArgs(args);
  const action = readAction(safeArgs);

  const courseId = resolveCourseId(safeArgs.courseId, registry);
  const weekKey = resolveWeekKey(courseId, safeArgs.weekKey, registry);

  const sanitized: Record<string, unknown> = {
    action,
    courseId,
    weekKey,
  };

  if (action === 'create' || action === 'update') {
    sanitized.title = normalizeLocalized(safeArgs.title, { key: 'ai.toolDefaults.weekTitle', params: { weekKey } });
  }

  if (action === 'delete') {
    sanitized.cascade = Boolean(safeArgs.cascade);
  }

  return { valid: true, sanitized };
}

type Section = 'lectures' | 'practice';

/** Practice/exercise sections are recognised by name; anything else is lectures. */
function readSection(raw: unknown): Section {
  if (typeof raw !== 'string') return 'lectures';
  const lower = raw.toLowerCase();
  return lower.includes('practice') || lower.includes('exercise') ? 'practice' : 'lectures';
}

/**
 * Validates and sanitizes parameters for content_editor_topic tool.
 */
export function validateTopicParams(
  args: Record<string, unknown>,
  registry?: Record<string, { catalog?: Record<string, unknown> }>
): ToolParamValidationResult {
  const safeArgs = asArgs(args);
  const action = readAction(safeArgs);

  const courseId = resolveCourseId(safeArgs.courseId, registry);
  const weekKey = resolveWeekKey(courseId, safeArgs.weekKey, registry);

  const section = readSection(safeArgs.section);

  const rawTopic = (safeArgs.topic as Record<string, unknown>) || {};
  const topicId = normalizeSlug(rawTopic.id, action === 'create' ? `${section === 'practice' ? 'practice' : 'lecture'}-1` : 'topic-1');

  const sanitized: Record<string, unknown> = {
    action,
    courseId,
    weekKey,
    section,
    topic: {
      id: topicId,
      title: normalizeLocalized(rawTopic.title, { key: section === 'practice' ? 'ai.toolDefaults.practiceTitle' : 'ai.toolDefaults.lectureTitle' }),
      description: normalizeLocalized(rawTopic.description, { key: 'ai.toolDefaults.topicDescription' }),
      ...(action === 'move' && { direction: rawTopic.direction, toIndex: rawTopic.toIndex }),
    },
  };

  return { valid: true, sanitized };
}

function courseBody(rawCourse: Record<string, unknown>) {
  const color = normalizeColor(rawCourse.color, '#06b6d4');
  const rawCode = typeof rawCourse.code === 'string' ? rawCourse.code.trim() : '';
  return {
    code: rawCode || `CS-${Math.floor(100 + Math.random() * 900)}`,
    title: normalizeLocalized(rawCourse.title, { key: 'ai.toolDefaults.courseTitle' }),
    subtitle: normalizeLocalized(rawCourse.subtitle, { key: 'ai.toolDefaults.courseSubtitle' }),
    description: normalizeLocalized(rawCourse.description, { key: 'ai.toolDefaults.courseDescription' }),
    badge: normalizeLocalized(rawCourse.badge, { key: 'ai.toolDefaults.courseBadge' }),
    icon: normalizeIcon(rawCourse.icon, 'Cpu'),
    color,
    accent: normalizeColor(rawCourse.accent, color),
  };
}

/**
 * Validates and sanitizes parameters for content_editor_course tool.
 */
export function validateCourseParams(
  args: Record<string, unknown>,
  registry?: Record<string, unknown>
): ToolParamValidationResult {
  const safeArgs = asArgs(args);
  const action = readAction(safeArgs);
  const rawId = typeof safeArgs.id === 'string' ? safeArgs.id : 'new-course';
  const id = action === 'create' ? normalizeSlug(rawId, 'new-course') : resolveCourseId(rawId, registry);

  const sanitized: Record<string, unknown> = { action, id };
  if (action === 'create' || action === 'update') {
    sanitized.course = courseBody((safeArgs.course as Record<string, unknown>) || {});
  }
  return { valid: true, sanitized };
}

export type { LocalizedObject, ToolParamValidationResult as ValidationResult } from './paramNormalizers';
export {
  normalizeLocalized,
  normalizeSlug,
  resolveCourseId,
  resolveWeekKey,
  normalizeColor,
  normalizeIcon,
} from './paramNormalizers';

/**
 * Master validation dispatcher for all content editor tools.
 */
export function validateToolParameters(
  toolName: string,
  args: Record<string, unknown>,
  registry?: Record<string, { catalog?: Record<string, unknown> }>
): ToolParamValidationResult {
  const safeArgs = args && typeof args === 'object' ? args : {};
  switch (toolName) {
    case 'content_editor_course':
      return validateCourseParams(safeArgs, registry);
    case 'content_editor_week':
      return validateWeekParams(safeArgs, registry);
    case 'content_editor_topic':
      return validateTopicParams(safeArgs, registry);
    default:
      return { valid: true, sanitized: safeArgs };
  }
}

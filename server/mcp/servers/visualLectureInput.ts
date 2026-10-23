import type { BuilderBlock, VisualSpec } from '../../../src/core/types/visualSpec.js';
import { BLOCK_DEFS } from '../../../src/core/visualBuilder/blocks.js';

const BLOCK_ACTIONS = new Set<string>([...BLOCK_DEFS.map((def) => def.action), 'pack']);

// The player runs every time value in milliseconds. A model that thinks in seconds writes 1.2, which plays as 1.2 ms
// (an instant jump), so anything this small is rejected with the unit spelled out instead of saved.
const MIN_MS = 10;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

function timeProblem(where: string, key: string, value: unknown): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return value === undefined ? null : `${where}: ${key} must be a number of milliseconds`;
  if (value < 0) return `${where}: ${key} cannot be negative`;
  if (value > 0 && value < MIN_MS) return `${where}: ${key} ${value} is in milliseconds, so it would play in ${value} ms. Use about 500 for half a second`;
  return null;
}

const found = (problem: string | null): problem is string => problem !== null;

const hasPoint = (to: BuilderBlock['to']): boolean => Boolean(to) && Number.isFinite(to?.x) && Number.isFinite(to?.y);

// What each action needs besides its timing; a block missing it would be dropped or do nothing in the step maker.
function actionProblem(where: string, block: BuilderBlock, ids: Set<string>): string | null {
  if (block.action === 'say') return block.text?.trim() ? null : `${where}: say needs "text"`;
  if (!block.target || !ids.has(block.target)) return `${where}: ${block.action} targets "${block.target ?? ''}", which is not an element id`;
  if (block.action === 'move' && !hasPoint(block.to)) return `${where}: move needs "to": {x, y}`;
  if (block.action === 'tint' && !block.color) return `${where}: tint needs "color", a theme token such as var(--viz-blue)`;
  return null;
}

function blockProblems(stepId: string, block: BuilderBlock, index: number, ids: Set<string>): string[] {
  const where = `step "${stepId}" block ${index}`;
  if (!BLOCK_ACTIONS.has(block.action)) return [`${where}: unknown action "${block.action}"; use one of ${[...BLOCK_ACTIONS].join(', ')}`];
  return [timeProblem(where, 'duration', block.duration), timeProblem(where, 'at', block.at), actionProblem(where, block, ids)].filter(found);
}

/** Problems an AI caller must fix before a spec is saved: time units, and block actions/targets the step maker would silently drop. */
export function visualLectureInputProblems(spec: VisualSpec): string[] {
  const ids = new Set(spec.elements.map((element) => element.id));
  return spec.steps.flatMap((step) => {
    const tweenTimes = step.tweens.flatMap((tween, index) =>
      ['duration', 'delay'].map((key) => timeProblem(`step "${step.id}" tween ${index}`, `params.${key}`, tween.params[key])).concat(timeProblem(`step "${step.id}" tween ${index}`, 'at', tween.at)),
    );
    const blocks = (step.builder?.blocks ?? []).flatMap((block, index) => blockProblems(step.id, block, index, ids));
    return [...tweenTimes.filter(found), ...blocks];
  });
}

/** Steps described only with builder.blocks need no hand-written tweens; the shape check wants the array to exist. */
export function withDefaultTweens(spec: unknown): unknown {
  if (!isRecord(spec) || !Array.isArray(spec.steps)) return spec;
  return { ...spec, steps: spec.steps.map((step) => (isRecord(step) && step.tweens === undefined ? { ...step, tweens: [] } : step)) };
}

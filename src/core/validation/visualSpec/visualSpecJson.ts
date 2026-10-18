import { migrateSpec } from '@core/visualBuilder/specMigrations';
import { validateVisualSpec } from './visualSpecValidation';
import { VISUAL_ELEMENT_KINDS, type VisualSpec } from '../../types/visualSpec';

export interface VisualSpecParseResult {
  spec: VisualSpec | null;
  problems: string[];
}

const ELEMENT_KINDS: readonly string[] = VISUAL_ELEMENT_KINDS;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function firstProblem(items: unknown[], check: (item: unknown, index: number) => string | null): string | null {
  for (let index = 0; index < items.length; index += 1) {
    const problem = check(items[index], index);
    if (problem) return problem;
  }
  return null;
}

function elementShapeProblem(element: unknown, index: number): string | null {
  const where = `elements[${index}]`;
  if (!isRecord(element) || typeof element.id !== 'string' || typeof element.kind !== 'string') {
    return `${where} needs string "id" and "kind"`;
  }
  if (!ELEMENT_KINDS.includes(element.kind)) return `${where}.kind must be one of ${ELEMENT_KINDS.join(', ')}`;
  if (!isRecord(element.attrs)) return `${where}.attrs must be an object`;
  if (element.style !== undefined && !isRecord(element.style)) return `${where}.style must be an object`;
  return null;
}

function tweenShapeProblem(tween: unknown, where: string): string | null {
  if (!isRecord(tween)) return `${where} must be an object`;
  const targetsOk =
    typeof tween.targets === 'string' ||
    (Array.isArray(tween.targets) && tween.targets.every((target) => typeof target === 'string'));
  if (!targetsOk) return `${where}.targets must be a string or an array of strings`;
  if (!isRecord(tween.params)) return `${where}.params must be an object`;
  return null;
}

function stepShapeProblem(step: unknown, index: number): string | null {
  const where = `steps[${index}]`;
  if (!isRecord(step) || typeof step.id !== 'string') return `${where} needs a string "id"`;
  if (!Array.isArray(step.tweens)) return `${where}.tweens must be an array`;
  return firstProblem(step.tweens, (tween, tweenIndex) => tweenShapeProblem(tween, `${where}.tweens[${tweenIndex}]`));
}

function pipelineShapeProblem(pipeline: unknown): string | null {
  if (pipeline === undefined) return null;
  if (!isRecord(pipeline) || !Array.isArray(pipeline.stages)) return 'pipeline must be an object with an array "stages"';
  const bad = pipeline.stages.findIndex((stage) => !isRecord(stage) || typeof stage.id !== 'string');
  return bad === -1 ? null : `pipeline.stages[${bad}] needs a string "id"`;
}

function shapeProblem(value: unknown): string | null {
  if (!isRecord(value)) return 'Spec must be a JSON object';
  if (typeof value.id !== 'string' || typeof value.viewBox !== 'string') return 'Spec needs string "id" and "viewBox"';
  if (!Array.isArray(value.elements) || !Array.isArray(value.steps)) return 'Spec needs array "elements" and "steps"';
  return (
    firstProblem(value.elements, elementShapeProblem) ??
    firstProblem(value.steps, stepShapeProblem) ??
    pipelineShapeProblem(value.pipeline)
  );
}

export function checkVisualSpec(value: unknown): VisualSpecParseResult {
  const problem = shapeProblem(value);
  if (problem) return { spec: null, problems: [problem] };
  const spec = migrateSpec(value as VisualSpec);
  return { spec, problems: validateVisualSpec(spec) };
}

export function parseVisualSpecJson(text: string): VisualSpecParseResult {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error) {
    return { spec: null, problems: [`Invalid JSON: ${error instanceof Error ? error.message : String(error)}`] };
  }
  return checkVisualSpec(value);
}

export function serializeVisualSpec(spec: VisualSpec): string {
  return JSON.stringify(spec, null, 2);
}

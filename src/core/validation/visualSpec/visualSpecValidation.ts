import type { BuilderBlock, VisualElementSpec, VisualSpec, VisualTweenSpec } from '../../types/visualSpec';
import { blocksOf } from '../../visualBuilder/blocks';
import { EFFECTS, kindsWord, objectKindOf } from '../../visualBuilder/effects';
import type { EffectSpec } from '../../visualBuilder/effectSpec';
import { validatePackAnime } from '../../visualBuilder/diagramPacks/validatePackEffects';
import { cutLabelLineProblems } from '../../visualBuilder/diagramPacks/packLabelSlots';
import { packObjectByRef } from '../../visualBuilder/diagramPacks/stylePackRegistry';
import { speedProblems } from './speedValidation';

const ID_PATTERN = /^[A-Za-z][A-Za-z0-9_-]*$/;

function validateElements(spec: VisualSpec): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const element of spec.elements) {
    if (!ID_PATTERN.test(element.id)) problems.push(`element id "${element.id}" must match ${ID_PATTERN}`);
    if (seen.has(element.id)) problems.push(`duplicate element id "${element.id}"`);
    seen.add(element.id);
  }
  return problems;
}

function validateParams(stepId: string, params: VisualTweenSpec['params']): string[] {
  return Object.entries(params)
    .filter(([, value]) => typeof value !== 'number' && typeof value !== 'string')
    .map(([key]) => `step "${stepId}": param "${key}" must be a number or string`);
}

function validateTween(stepId: string, tween: VisualTweenSpec, knownIds: Set<string>): string[] {
  const problems: string[] = [];
  const targets = Array.isArray(tween.targets) ? tween.targets : [tween.targets];
  if (targets.length === 0) problems.push(`step "${stepId}": tween needs at least one target`);
  for (const target of targets) {
    if (!knownIds.has(target)) problems.push(`step "${stepId}": unknown target "${target}"`);
  }
  problems.push(...validateParams(stepId, tween.params));
  if (tween.at !== undefined && !(Number.isFinite(tween.at) && tween.at >= 0)) {
    problems.push(`step "${stepId}": tween "at" must be a finite number >= 0`);
  }
  return problems;
}

function validateSteps(spec: VisualSpec): string[] {
  if (spec.steps.length === 0) return ['spec has no steps'];
  const knownIds = new Set(spec.elements.map((element) => element.id));
  const stageIds = new Set((spec.pipeline?.stages ?? []).map((stage) => stage.id));
  const problems: string[] = [];
  spec.steps.forEach((step) => {
    if (step.activeStage && !stageIds.has(step.activeStage)) {
      problems.push(`step "${step.id}": unknown activeStage "${step.activeStage}"`);
    }
    for (const tween of step.tweens) problems.push(...validateTween(step.id, tween, knownIds));
  });
  return problems;
}

// Lecture data has no builder blocks, so only blocks that name an effect are checked against the rule table.
function effectFitProblem(stepId: string, block: BuilderBlock, elements: Map<string, VisualElementSpec>): string[] {
  if (block.action === 'pack') return packBlockProblems(stepId, block, elements);
  return fitProblem(stepId, EFFECTS.find((candidate) => candidate.action === block.action), block, elements);
}

// A pack block names its effect by id; an id the registry does not know cannot be played or fitted.
function packBlockProblems(stepId: string, block: BuilderBlock, elements: Map<string, VisualElementSpec>): string[] {
  const effect = EFFECTS.find((candidate) => candidate.action === 'pack' && candidate.id === block.effect);
  if (!effect) return [`step "${stepId}": unknown pack effect "${block.effect ?? ''}"`];
  const params = block.params ? validatePackAnime(block.params, 'params').map((issue) => `step "${stepId}": pack effect ${issue.path} ${issue.message}`) : [];
  return [...params, ...fitProblem(stepId, effect, block, elements)];
}

function fitProblem(stepId: string, effect: EffectSpec | undefined, block: BuilderBlock, elements: Map<string, VisualElementSpec>): string[] {
  const element = block.target === undefined ? undefined : elements.get(block.target);
  if (!effect || !element) return [];
  const kind = objectKindOf(element);
  if (effect.kinds.includes(kind)) return [];
  return [`step "${stepId}": effect "${effect.label}" does not fit "${element.id}" (${kindsWord([kind])}); it fits ${kindsWord(effect.kinds)}`];
}

function validateEffectFit(spec: VisualSpec): string[] {
  const elements = new Map(spec.elements.map((element) => [element.id, element]));
  return spec.steps.flatMap((step) => blocksOf(step).flatMap((block) => effectFitProblem(step.id, block, elements)));
}

export function validateVisualSpec(spec: VisualSpec): string[] {
  return [...validateElements(spec), ...validateSteps(spec), ...speedProblems(spec), ...validateEffectFit(spec), ...cutLabelLineProblems(spec, packObjectByRef)];
}

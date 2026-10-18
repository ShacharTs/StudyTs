import type { BuilderBlock, VisualSpec } from '../../../types/visualSpec';
import { COLOR_CHOICES } from '../../builderColors';
import type { StylePackIssue } from '../../diagramPacks/stylePackFormat';
import { checkUnknownFields, isRecord, packIssue } from '../../diagramPacks/validatePackPrimitives';
import { appendStep } from '../../recipes';
import { algorithmText, checkColorGroup, checkKeyGroup, failOnIssues, type ColorName, type TextKey } from '../algorithmText';
import styleFile from '../styles/pipeline-run.style.json';
import type { PipelineStage } from './pipelineModel';
import type { PipelineEvent } from './runPipeline';

export interface PipelineStyle {
  format: 1;
  id: string;
  colors: { stalled: ColorName; bottleneck: ColorName };
  captions: { tick: TextKey; done: TextKey };
  whys: { tick: TextKey; bottleneck: TextKey; clear: TextKey };
}

export function validatePipelineStyle(value: unknown): StylePackIssue[] {
  if (!isRecord(value)) return [packIssue('', 'bad-value', 'pipeline style must be an object')];
  return [
    ...checkUnknownFields(value, ['format', 'id', 'colors', 'captions', 'whys'], ''),
    ...(value.format === 1 ? [] : [packIssue('format', 'bad-value', 'format must be 1')]),
    ...checkColorGroup(value.colors, ['stalled', 'bottleneck'], 'colors'),
    ...checkKeyGroup(value.captions, ['tick', 'done'], 'captions'),
    ...checkKeyGroup(value.whys, ['tick', 'bottleneck', 'clear'], 'whys'),
  ];
}

export function pipelineStyle(): PipelineStyle {
  failOnIssues('Pipeline style', validatePipelineStyle(styleFile));
  return styleFile as PipelineStyle;
}

const block = (action: BuilderBlock['action'], target: string): BuilderBlock => ({ action, target, speed: 'normal' });
const tint = (target: string, name: string): BuilderBlock => ({ ...block('tint', target), color: COLOR_CHOICES.find((choice) => choice.name.toLowerCase() === name)?.value });

export interface PipelinePresentInput {
  spec: VisualSpec;
  stages: PipelineStage[];
  trace: PipelineEvent[];
  tokens: number;
  style: PipelineStyle;
  lang: string;
}

interface PresentContext {
  style: PipelineStyle;
  lang: string;
  tokens: number;
  nameOf: (stage: string) => string;
}

const textOf = (key: TextKey, context: PresentContext, values: Record<string, string> = {}): string => algorithmText(key, context.lang, values);

function tickStep(current: VisualSpec, event: Extract<PipelineEvent, { type: 'tick' }>, context: PresentContext): VisualSpec {
  const names = event.stalled.map(context.nameOf);
  const values = { number: String(event.number), stalled: names.length > 0 ? names.join(', ') : textOf('pipeNone', context) };
  const holding = event.stages.map(({ stage, held }) => block(held > 0 ? 'highlight' : 'calm', stage));
  const stuck = event.stalled.map((stage) => tint(stage, context.style.colors.stalled));
  return appendStep(current, textOf(context.style.captions.tick, context, values), [...holding, ...stuck], textOf(context.style.whys.tick, context, values));
}

function verdictStep(current: VisualSpec, event: Extract<PipelineEvent, { type: 'verdict' }>, context: PresentContext): VisualSpec {
  const values = { done: String(event.done), tokens: String(context.tokens), ticks: String(event.ticks), stage: event.bottleneck ? context.nameOf(event.bottleneck) : '' };
  const why = event.bottleneck ? context.style.whys.bottleneck : context.style.whys.clear;
  const blocks = event.bottleneck ? [block('highlight', event.bottleneck), tint(event.bottleneck, context.style.colors.bottleneck)] : [];
  return appendStep(current, textOf(context.style.captions.done, context, values), blocks, textOf(why, context, values));
}

// Appends the run as ordinary steps: one per tick, then a verdict that tints the stage that stalled most often.
export function presentPipelineTrace({ spec, stages, trace, tokens, style, lang }: PipelinePresentInput): VisualSpec {
  const labels = new Map(stages.map((stage) => [stage.id, stage.label]));
  const context: PresentContext = { style, lang, tokens, nameOf: (stage) => labels.get(stage) ?? stage };
  return trace.reduce((current: VisualSpec, event) => (event.type === 'tick' ? tickStep(current, event, context) : verdictStep(current, event, context)), spec);
}

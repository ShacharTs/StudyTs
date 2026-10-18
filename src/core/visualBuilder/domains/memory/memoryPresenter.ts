import type { BuilderBlock, VisualSpec } from '../../../types/visualSpec';
import { COLOR_CHOICES } from '../../builderColors';
import type { StylePackIssue } from '../../diagramPacks/stylePackFormat';
import { checkUnknownFields, isRecord, packIssue } from '../../diagramPacks/validatePackPrimitives';
import { addEffectAtStart, appendStep } from '../../recipes';
import { algorithmText, checkColorGroup, checkKeyGroup, failOnIssues, type ColorName, type TextKey } from '../algorithmText';
import type { GraphModel } from '../graph/graphModel';
import styleFile from '../styles/memory-run.style.json';
import type { ChaseEvent, ChaseTrace, LeakEvent, LeakTrace } from './runMemory';

const TITLES = ['root', 'reach', 'leak', 'verdict', 'follow', 'block', 'null', 'cycle', 'dangling'] as const;
type Title = (typeof TITLES)[number];

// How a memory run reads: the leak and reachable colours by name, and the text keys of every title and sentence.
export interface MemoryStyle {
  format: 1;
  id: string;
  colors: { leak: ColorName; reachable: ColorName };
  captions: Record<Title, TextKey>;
  whys: Record<Title, TextKey>;
}

export function validateMemoryStyle(value: unknown): StylePackIssue[] {
  if (!isRecord(value)) return [packIssue('', 'bad-value', 'memory style must be an object')];
  return [
    ...checkUnknownFields(value, ['format', 'id', 'colors', 'captions', 'whys'], ''),
    ...(value.format === 1 ? [] : [packIssue('format', 'bad-value', 'format must be 1')]),
    ...checkColorGroup(value.colors, ['leak', 'reachable'], 'colors'),
    ...checkKeyGroup(value.captions, TITLES, 'captions'),
    ...checkKeyGroup(value.whys, TITLES, 'whys'),
  ];
}

export function memoryStyle(): MemoryStyle {
  failOnIssues('Memory style', validateMemoryStyle(styleFile));
  return styleFile as MemoryStyle;
}

const block = (action: BuilderBlock['action'], target: string): BuilderBlock => ({ action, target, speed: 'normal' });
const tint = (target: string, name: string): BuilderBlock => ({ ...block('tint', target), color: COLOR_CHOICES.find((choice) => choice.name.toLowerCase() === name)?.value });

export interface MemoryPresentInput {
  spec: VisualSpec;
  graph: GraphModel;
  style: MemoryStyle;
  lang: string;
}

// Appends one ordinary step: the caption and the explanation are text keys filled with the values of the event.
function step(current: VisualSpec, style: MemoryStyle, lang: string, title: Title, values: Record<string, string>, blocks: BuilderBlock[]): VisualSpec {
  return appendStep(current, algorithmText(style.captions[title], lang, values), blocks, algorithmText(style.whys[title], lang, values));
}

const listOf = (labels: string[], lang: string): string => (labels.length > 0 ? labels.join(', ') : algorithmText('memNone', lang));

// Leaks are red and reachable blocks green; the verdict step names both lists.
export function presentLeakTrace({ spec, graph, style, lang }: MemoryPresentInput, trace: LeakTrace): VisualSpec {
  const stepFor = (current: VisualSpec, event: LeakEvent): VisualSpec => {
    if (event.type === 'root') return step(current, style, lang, 'root', { cell: graph.labelOf(event.cell) }, [block('highlight', event.cell)]);
    if (event.type === 'reach') {
      const values = { block: graph.labelOf(event.block), via: listOf(event.via.map(graph.labelOf), lang) };
      return step(current, style, lang, 'reach', values, [tint(event.block, style.colors.reachable), block('highlight', event.block)]);
    }
    if (event.type === 'leak') return step(current, style, lang, 'leak', { block: graph.labelOf(event.block) }, [tint(event.block, style.colors.leak), block('highlight', event.block)]);
    const values = { leaks: listOf(event.leaks.map(graph.labelOf), lang), reachable: listOf(event.reachable.map(graph.labelOf), lang) };
    return step(current, style, lang, 'verdict', values, []);
  };
  return trace.reduce(stepFor, spec);
}

// Each followed pointer is a step with a travelling dot on its arrow; the last step names how the chain ended.
export function presentChaseTrace({ spec, graph, style, lang }: MemoryPresentInput, trace: ChaseTrace): VisualSpec {
  const stepFor = (current: VisualSpec, event: ChaseEvent): VisualSpec => {
    if (event.type === 'follow') {
      const values = { from: graph.labelOf(event.from), to: graph.labelOf(event.to), number: String(event.number) };
      const blocks = [block('calm', event.from), block('highlight', event.edge), block('highlight', event.to)];
      const stepped = step(current, style, lang, 'follow', values, blocks);
      return addEffectAtStart(stepped, stepped.steps.length - 1, 'travel', event.edge);
    }
    const color = event.result === 'block' ? style.colors.reachable : style.colors.leak;
    return step(current, style, lang, event.result, { at: graph.labelOf(event.at) }, [block('highlight', event.at), tint(event.at, color)]);
  };
  return trace.reduce(stepFor, spec);
}

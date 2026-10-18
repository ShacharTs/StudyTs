import { parseViewBox } from '../../shared/stageSize';
import type { BuilderBlock, VisualSpec } from '../../types/visualSpec';
import { addBlock } from '../blocks';
import { COLOR_CHOICES } from '../builderColors';
import { renameBuilderElement, resizeElement, setShapeText } from '../builderEdits';
import { elementBox } from '../builderGeometry';
import { addEffectAtStart, appendStep } from '../recipes';
import { addShapeAt } from '../sceneEdits';
import type { StylePackIssue } from '../diagramPacks/stylePackFormat';
import { checkUnknownFields, isRecord, packIssue } from '../diagramPacks/validatePackPrimitives';
import { algorithmText, checkColorGroup, checkKeyGroup, failOnIssues, type ColorName, type TextKey } from './algorithmText';
import flowStyleFile from './styles/flow-augment.style.json';
import type { GraphModel } from './graph/graphModel';
import type { FlowEvent, FlowTrace } from './trace';

const CAPTION_KEYS = ['start', 'augment', 'done'] as const;

// How a flow run reads: colours by name and the text keys of the captions and the strip word.
export interface FlowStyle {
  format: 1;
  id: string;
  colors: { path: ColorName; cut: ColorName };
  captions: Record<(typeof CAPTION_KEYS)[number], TextKey>;
  strip: { flow: TextKey };
}

export function validateFlowStyle(value: unknown): StylePackIssue[] {
  if (!isRecord(value)) return [packIssue('', 'bad-value', 'flow style must be an object')];
  return [
    ...checkUnknownFields(value, ['format', 'id', 'colors', 'captions', 'strip'], ''),
    ...(value.format === 1 ? [] : [packIssue('format', 'bad-value', 'format must be 1')]),
    ...checkColorGroup(value.colors, ['path', 'cut'], 'colors'),
    ...checkKeyGroup(value.captions, CAPTION_KEYS, 'captions'),
    ...checkKeyGroup(value.strip, ['flow'], 'strip'),
  ];
}

export function flowStyle(): FlowStyle {
  failOnIssues('Flow style', validateFlowStyle(flowStyleFile));
  return flowStyleFile as FlowStyle;
}

const block = (action: BuilderBlock['action'], target: string): BuilderBlock => ({ action, target, speed: 'normal' });
const tint = (target: string, name: string): BuilderBlock => ({ ...block('tint', target), color: COLOR_CHOICES.find((choice) => choice.name.toLowerCase() === name)?.value });
const hide = (spec: VisualSpec, step: number, id: string | undefined): VisualSpec => (id ? addBlock(spec, step, block('hide', id)) : spec);

export interface FlowPresentInput {
  spec: VisualSpec;
  model: GraphModel;
  trace: FlowTrace;
  source: string;
  sink: string;
  style: FlowStyle;
  lang: string;
}

// Where an edge's number lives: its label box when it has one, else the middle of its line.
function labelBox(spec: VisualSpec, edge: string): { x: number; y: number; w: number; h: number } {
  const label = spec.elements.find((el) => el.id === `${edge}-label`);
  const line = spec.elements.find((el) => el.id === edge);
  const box = elementBox((label ?? line) as NonNullable<typeof label>);
  return { x: box.x, y: box.y, w: Math.max(box.w, 56), h: Math.max(box.h, 22) };
}

// A `used/capacity` caption sits where the capacity label is; the first step hides the plain labels and later steps swap captions.
function withFlowLabel(spec: VisualSpec, step: number, edge: string, text: string, name: string, shown: Map<string, string>): VisualSpec {
  const box = labelBox(spec, edge);
  const hidden = hide(spec, step, shown.get(edge));
  const added = addShapeAt(hidden, step, 'caption', { x: box.x + box.w / 2, y: box.y + box.h / 2 });
  const sized = resizeElement(added.spec, added.id, box);
  shown.set(edge, added.id);
  return setShapeText(renameBuilderElement(sized, added.id, name), added.id, text);
}

function writeStrip(spec: VisualSpec, step: number, text: string, name: string): { spec: VisualSpec; id: string } {
  const view = parseViewBox(spec.viewBox);
  const box = { x: view.w / 2 - 120, y: view.h * 0.93 - 14, w: 240, h: 28 };
  const added = addShapeAt(spec, step, 'caption', { x: box.x + box.w / 2, y: box.y + box.h / 2 });
  const sized = resizeElement(added.spec, added.id, box);
  return { spec: setShapeText(renameBuilderElement(sized, added.id, name), added.id, text), id: added.id };
}

function augmentBlocks(event: Extract<FlowEvent, { type: 'augment' }>, previous: FlowEvent | null, style: FlowStyle): BuilderBlock[] {
  const calm = previous && previous.type === 'augment' ? previous.vertices.map((id) => block('calm', id)) : [];
  return [...calm, ...event.vertices.map((id) => tint(id, style.colors.path)), ...event.edges.map((id) => tint(id, style.colors.path))];
}

// Appends the run as ordinary steps: the capacities become `used/capacity` captions and each augmenting path lights up.
export function presentFlowTrace({ spec, model, trace, source, sink, style, lang }: FlowPresentInput): VisualSpec {
  const shown = new Map<string, string>();
  const labelName = algorithmText('nameFlowLabel', lang);
  const stripName = algorithmText('nameStrip', lang);
  const pathText = (ids: string[]): string => ids.map((id) => model.labelOf(id)).join('-');
  const names = { source: model.labelOf(source), sink: model.labelOf(sink) };
  const capacityOf = new Map(model.edges.map((edge) => [edge.id, edge.weight]));
  let next = appendStep(spec, algorithmText(style.captions.start, lang, names), [block('highlight', source), block('highlight', sink), ...model.edges.map((edge) => block('hide', `${edge.id}-label`))]);
  let step = next.steps.length - 1;
  next = model.edges.reduce((current, edge) => withFlowLabel(current, step, edge.id, `0/${capacityOf.get(edge.id)}`, labelName, shown), next);
  let strip: string | undefined;
  let previous: FlowEvent | null = null;
  const written = writeStrip(next, step, `${algorithmText(style.strip.flow, lang)}: 0`, stripName);
  next = written.spec;
  strip = written.id;
  trace.forEach((event) => {
    if (event.type === 'augment') {
      const title = algorithmText(style.captions.augment, lang, { path: pathText(event.vertices), pushed: String(event.pushed) });
      next = appendStep(next, title, augmentBlocks(event, previous, style));
      step = next.steps.length - 1;
      next = hide(next, step, strip);
      event.edges.forEach((edge) => {
        next = withFlowLabel(next, step, edge, `${event.flows[edge] ?? 0}/${capacityOf.get(edge)}`, labelName, shown);
      });
      const first = event.edges[0];
      if (first) next = addEffectAtStart(next, step, 'travel', first);
      const strip2 = writeStrip(next, step, `${algorithmText(style.strip.flow, lang)}: ${event.total}`, stripName);
      next = strip2.spec;
      strip = strip2.id;
      previous = event;
      return;
    }
    const done = appendStep(next, algorithmText(style.captions.done, lang, { value: String(event.value) }), [...event.edges.map((edge) => tint(edge, style.colors.cut)), ...(previous && previous.type === 'augment' ? previous.vertices.map((id) => block('calm', id)) : [])]);
    next = hide(done, done.steps.length - 1, strip);
  });
  return next;
}

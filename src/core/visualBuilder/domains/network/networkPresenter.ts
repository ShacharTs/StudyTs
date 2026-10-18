import type { BuilderBlock, VisualSpec } from '../../../types/visualSpec';
import { COLOR_CHOICES } from '../../builderColors';
import type { StylePackIssue } from '../../diagramPacks/stylePackFormat';
import { checkUnknownFields, isRecord, packIssue } from '../../diagramPacks/validatePackPrimitives';
import { addEffectAtStart, appendStep } from '../../recipes';
import { algorithmText, checkColorGroup, checkKeyGroup, failOnIssues, type ColorName, type TextKey } from '../algorithmText';
import type { GraphModel } from '../graph/graphModel';
import styleFile from '../styles/network-route.style.json';
import type { RouteEvent, RouteTrace } from './runRoute';

const TITLES = ['start', 'hop', 'delivered', 'unreachable', 'expired'] as const;

// How a sent packet reads: the verdict colours by name and the text keys of the titles and sentences.
export interface NetworkStyle {
  format: 1;
  id: string;
  colors: { delivered: ColorName; failed: ColorName };
  captions: Record<(typeof TITLES)[number], TextKey>;
  whys: Record<(typeof TITLES)[number], TextKey>;
}

export function validateNetworkStyle(value: unknown): StylePackIssue[] {
  if (!isRecord(value)) return [packIssue('', 'bad-value', 'network style must be an object')];
  return [
    ...checkUnknownFields(value, ['format', 'id', 'colors', 'captions', 'whys'], ''),
    ...(value.format === 1 ? [] : [packIssue('format', 'bad-value', 'format must be 1')]),
    ...checkColorGroup(value.colors, ['delivered', 'failed'], 'colors'),
    ...checkKeyGroup(value.captions, TITLES, 'captions'),
    ...checkKeyGroup(value.whys, TITLES, 'whys'),
  ];
}

export function networkStyle(): NetworkStyle {
  failOnIssues('Network style', validateNetworkStyle(styleFile));
  return styleFile as NetworkStyle;
}

const block = (action: BuilderBlock['action'], target: string): BuilderBlock => ({ action, target, speed: 'normal' });
const tint = (target: string, name: string): BuilderBlock => ({ ...block('tint', target), color: COLOR_CHOICES.find((choice) => choice.name.toLowerCase() === name)?.value });

export interface NetworkPresentInput {
  spec: VisualSpec;
  model: GraphModel;
  trace: RouteTrace;
  ttl: number;
  style: NetworkStyle;
  lang: string;
}

// Appends the send as ordinary steps: the packet leaves, rides each cable, and the last step says delivered, unreachable or dropped.
export function presentRouteTrace({ spec, model, trace, ttl, style, lang }: NetworkPresentInput): VisualSpec {
  const stepFor = (current: VisualSpec, event: RouteEvent): VisualSpec => {
    if (event.type === 'start') {
      const values = { device: model.labelOf(event.device), ttl: String(ttl) };
      return appendStep(current, algorithmText(style.captions.start, lang, values), [block('highlight', event.device)], algorithmText(style.whys.start, lang, values));
    }
    if (event.type === 'hop') {
      const values = { from: model.labelOf(event.from), to: model.labelOf(event.to), number: String(event.number), ttlLeft: String(event.ttlLeft) };
      const blocks = [block('calm', event.from), block('highlight', event.edge), block('highlight', event.to)];
      const stepped = appendStep(current, algorithmText(style.captions.hop, lang, values), blocks, algorithmText(style.whys.hop, lang, values));
      return addEffectAtStart(stepped, stepped.steps.length - 1, 'travel', event.edge);
    }
    const color = event.verdict === 'delivered' ? style.colors.delivered : style.colors.failed;
    const values = { device: model.labelOf(event.device), hops: String(event.hops) };
    const blocks = [block('highlight', event.device), tint(event.device, color)];
    return appendStep(current, algorithmText(style.captions[event.verdict], lang, values), blocks, algorithmText(style.whys[event.verdict], lang, values));
  };
  return trace.reduce(stepFor, spec);
}

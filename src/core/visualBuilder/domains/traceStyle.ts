import type { StylePackIssue } from '../diagramPacks/stylePackFormat';
import { checkEnum, checkUnknownFields, isRecord, packIssue } from '../diagramPacks/validatePackPrimitives';
import { checkColorGroup, checkKeyGroup, failOnIssues, type ColorName, type TextKey } from './algorithmText';
import discoverVisit from './styles/graph-discover-visit.style.json';

export const TRACE_STYLE_FORMAT = 1;
export const GRANULARITIES = ['perVisit', 'perEvent'] as const;
const CAPTION_KEYS = ['start', 'visit', 'discover', 'done'] as const;
const STRIP_KEYS = ['fifo', 'lifo', 'priority', 'order'] as const;

// How a trace reads on the stage: colours by name (the theme decides the value) and the text keys of the captions and the strip words.
export interface TraceStyle {
  format: typeof TRACE_STYLE_FORMAT;
  id: string;
  granularity: (typeof GRANULARITIES)[number];
  colors: { discovered: ColorName; visited: ColorName };
  captions: Record<(typeof CAPTION_KEYS)[number], TextKey>;
  strip: Record<(typeof STRIP_KEYS)[number], TextKey>;
}

export function validateTraceStyle(value: unknown): StylePackIssue[] {
  if (!isRecord(value)) return [packIssue('', 'bad-value', 'trace style must be an object')];
  return [
    ...checkUnknownFields(value, ['format', 'id', 'granularity', 'colors', 'captions', 'strip'], ''),
    ...(value.format === TRACE_STYLE_FORMAT ? [] : [packIssue('format', 'bad-value', `format must be ${TRACE_STYLE_FORMAT}`)]),
    ...(typeof value.id === 'string' && value.id.length > 0 ? [] : [packIssue('id', 'bad-id', 'id must be a non-empty string')]),
    ...checkEnum(value.granularity, GRANULARITIES, 'granularity', 'bad-enum'),
    ...checkColorGroup(value.colors, ['discovered', 'visited'], 'colors'),
    ...checkKeyGroup(value.captions, CAPTION_KEYS, 'captions'),
    ...checkKeyGroup(value.strip, STRIP_KEYS, 'strip'),
  ];
}

const STYLES: unknown[] = [discoverVisit];

export function traceStyleById(id: string): TraceStyle | undefined {
  const found = STYLES.find((style) => isRecord(style) && style.id === id);
  if (!found) return undefined;
  failOnIssues('Trace style', validateTraceStyle(found));
  return found as TraceStyle;
}

export const DEFAULT_TRACE_STYLE = 'graph/discover-visit';

import { BUILDER_TEXT, useTranslation } from '@i18n';
import type { BuilderShape, VisualSpec } from '@core/types/visualSpec';
import { describeElementWith, type ElementWords } from '@core/visualBuilder/builderEdits';
import { describeHint, renderHint, type BuilderMode, type HintKey } from '@core/visualBuilder/builderMode';
import { effectLabel, OBJECT_KINDS, type ObjectKind } from '@core/visualBuilder/effects';

type TextKey = keyof typeof BUILDER_TEXT;

const SHAPE_KEY: Record<string, TextKey> = {
  circle: 'shapeCircle',
  ellipse: 'shapeOval',
  box: 'shapeBox',
  rounded: 'shapeRounded',
  diamond: 'shapeDiamond',
  triangle: 'shapeTriangle',
  line: 'shapeLine',
  arrow: 'shapeArrow',
  text: 'shapeText',
  heading: 'shapeHeading',
  caption: 'shapeCaption',
  note: 'shapeNote',
};

const KIND_KEY: Record<ObjectKind, TextKey> = { arrow: 'edKindArrows', closed: 'edKindShapes', box: 'edKindBoxes', text: 'edKindText', path: 'edKindLines' };

const effectKey = (id: string): string => `edEffect${id.charAt(0).toUpperCase()}${id.slice(1)}`;

// Everything the builder says about names, in the language of the interface: shapes, arrows, effects, kinds and the mode hints.
export function useBuilderNames() {
  const { val } = useTranslation();
  const say = (key: TextKey, values: Record<string, string> = {}): string => val(BUILDER_TEXT[key]).replace(/\{(\w+)\}/g, (_match, name: string) => values[name] ?? '');
  const shapeName = (shape?: BuilderShape): string => say(SHAPE_KEY[shape ?? ''] ?? 'shapeUnknown');
  const words: ElementWords = {
    arrow: (from, to) => say('nameArrow', { from, to }),
    labelled: (shape, label) => say('nameLabelled', { shape, label }),
    identified: (shape, id) => say('nameIdentified', { shape, id }),
    shape: shapeName,
  };
  const effectName = (id: string, fallback?: string): string => {
    const entry = (BUILDER_TEXT as Record<string, unknown>)[effectKey(id)];
    return entry === undefined ? (fallback ?? effectLabel(id)) : val(entry);
  };
  const kindsName = (kinds: readonly ObjectKind[]): string => {
    if (kinds.length === OBJECT_KINDS.length) return say('edAnyObject');
    return kinds.map((kind) => say(KIND_KEY[kind])).join(` ${say('edOr')} `);
  };
  const elementName = (spec: VisualSpec, id: string): string => describeElementWith(spec, id, words);
  const hintOf = (mode: BuilderMode, spec: VisualSpec): string =>
    renderHint(describeHint(mode), { say: (key: HintKey, values) => say(key, values), nameOf: (id) => elementName(spec, id), effectName: (id) => effectName(id), kindsName });
  return { say, elementName, effectName, kindsName, hintOf };
}

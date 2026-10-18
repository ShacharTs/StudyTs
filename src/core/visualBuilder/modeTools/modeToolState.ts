import type { VisualSpec } from '../../types/visualSpec';
import { isOwner, resizeElement } from '../builderEdits';
import { elementBox } from '../builderGeometry';
import { setLinkArrow, setLinkLabel } from '../connectors';
import type { InsertCommand } from '../galleryModel';
import type { PresetShape } from '../shapeCatalog';
import { newAutomaton, readWord, runInput, setWord } from './automataTools';
import { moveHead, newTape, parseTapeInput, scanTape, setTape, tapeText } from './tapeTools';
import { layoutRing, toggleOverlaps } from './vennTools';

const PRESET_PREFIX = 'preset/';
const DEFAULT_LABEL = '1';

// A tool names what it places as `preset/<shape>` or `<pack>/<object>`; the gallery's insert command does the placing.
export function insertCommandFor(ref: string): InsertCommand {
  if (ref.startsWith(PRESET_PREFIX)) return { kind: 'preset', shape: ref.slice(PRESET_PREFIX.length) as PresetShape };
  return { kind: 'pack', ref };
}

const linkIdsOf = (spec: VisualSpec): string[] => spec.elements.filter((el) => el.builder?.link).map((el) => el.id);
const hasLabel = (spec: VisualSpec, linkId: string): boolean => spec.elements.some((el) => el.id === `${linkId}-label`);

export interface ModeToolState {
  items: number;
  links: number;
  directed: boolean;
  weighted: boolean;
}

export function modeToolState(spec: VisualSpec): ModeToolState {
  const links = linkIdsOf(spec);
  const directed = links.length > 0 && links.every((id) => spec.elements.find((el) => el.id === id)?.builder?.link?.arrow === true);
  return { items: spec.elements.filter(isOwner).length, links: links.length, directed, weighted: links.some((id) => hasLabel(spec, id)) };
}

export const setDirected = (spec: VisualSpec, directed: boolean): VisualSpec => linkIdsOf(spec).reduce((acc, id) => setLinkArrow(acc, id, directed), spec);

// Weighted means every edge carries a number: turning it on labels the bare ones with 1, turning it off clears the labels.
export function setWeighted(spec: VisualSpec, weighted: boolean): VisualSpec {
  return linkIdsOf(spec).reduce((acc, id) => {
    if (!weighted) return setLinkLabel(acc, id, '');
    return hasLabel(acc, id) ? acc : setLinkLabel(acc, id, DEFAULT_LABEL);
  }, spec);
}

// Resizes a box shape around its own centre so the slider never makes it jump.
export function resizeAroundCentre(spec: VisualSpec, id: string, size: number): VisualSpec {
  const element = spec.elements.find((el) => el.id === id);
  if (!element) return spec;
  const box = elementBox(element);
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const ratio = box.w === 0 ? 1 : box.h / box.w;
  return resizeElement(spec, id, { x: cx - size / 2, y: cy - (size * ratio) / 2, w: size, h: size * ratio });
}

// Every action gets the language, so what it writes on the stage (names, captions) follows the interface language.
const MODE_ACTIONS: Record<string, (spec: VisualSpec, lang: string) => VisualSpec> = {
  rearrange: layoutRing,
  overlaps: toggleOverlaps,
  newTape,
  scanTape,
  runInput,
  newAutomaton,
  headLeft: (spec) => moveHead(spec, -1),
  headRight: (spec) => moveHead(spec, 1),
};

// A starter builds the whole drawing, so it starts from the same spec with nothing on the stage and one empty step.
export const clearedSpec = (spec: VisualSpec): VisualSpec => ({
  ...spec,
  elements: [],
  steps: [{ ...spec.steps[0], tweens: [], builder: { ...spec.steps[0]?.builder, blocks: [] } }],
});

export const runModeAction = (id: string, spec: VisualSpec, lang = 'en'): VisualSpec => (MODE_ACTIONS[id] ?? ((same: VisualSpec) => same))(spec, lang);

const INPUTS: Record<string, { read: (spec: VisualSpec) => string; write: (spec: VisualSpec, value: string, lang: string) => VisualSpec }> = {
  // A newly typed tape starts with the head on its first cell, so Scan reads the whole input.
  tape: { read: tapeText, write: (spec, value, lang) => setTape(spec, parseTapeInput(value), 0, lang) },
  word: { read: readWord, write: setWord },
};

export const readModeInput = (key: string, spec: VisualSpec): string => INPUTS[key]?.read(spec) ?? '';
export const writeModeInput = (key: string, spec: VisualSpec, value: string, lang = 'en'): VisualSpec => INPUTS[key]?.write(spec, value, lang) ?? spec;

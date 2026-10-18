import type { BuilderBlock, VisualSpec } from '../../../types/visualSpec';
import { COLOR_CHOICES } from '../../builderColors';
import type { StylePackIssue } from '../../diagramPacks/stylePackFormat';
import { checkUnknownFields, isRecord, packIssue } from '../../diagramPacks/validatePackPrimitives';
import { addEffectAtStart, appendStep } from '../../recipes';
import { moveAtStep } from '../../sceneEdits';
import { algorithmText, checkColorGroup, checkKeyGroup, failOnIssues, type ColorName, type TextKey } from '../algorithmText';
import styleFile from '../styles/automaton-run.style.json';
import type { Automaton } from './automatonModel';
import type { AutomatonEvent, AutomatonTrace } from './runAutomaton';

const TITLES = ['start', 'read', 'accept', 'reject', 'stuck'] as const;
const WHYS = ['read', 'accept', 'reject', 'stuck'] as const;

// How a word run reads: the verdict colours by name and the text keys of the titles and explanations (words live in the i18n tables).
export interface AutomatonStyle {
  format: 1;
  id: string;
  colors: { accept: ColorName; reject: ColorName };
  captions: Record<(typeof TITLES)[number], TextKey>;
  whys: Record<(typeof WHYS)[number], TextKey>;
}

export function validateAutomatonStyle(value: unknown): StylePackIssue[] {
  if (!isRecord(value)) return [packIssue('', 'bad-value', 'automaton style must be an object')];
  return [
    ...checkUnknownFields(value, ['format', 'id', 'colors', 'captions', 'whys'], ''),
    ...(value.format === 1 ? [] : [packIssue('format', 'bad-value', 'format must be 1')]),
    ...checkColorGroup(value.colors, ['accept', 'reject'], 'colors'),
    ...checkKeyGroup(value.captions, TITLES, 'captions'),
    ...checkKeyGroup(value.whys, WHYS, 'whys'),
  ];
}

export function automatonStyle(): AutomatonStyle {
  failOnIssues('Automaton style', validateAutomatonStyle(styleFile));
  return styleFile as AutomatonStyle;
}

const block = (action: BuilderBlock['action'], target: string): BuilderBlock => ({ action, target, speed: 'normal' });
const tint = (target: string, name: string): BuilderBlock => ({ ...block('tint', target), color: COLOR_CHOICES.find((choice) => choice.name.toLowerCase() === name)?.value });

// The input tape drawn with the machine: the cell ids in order, their centres and the parts that slide with the head.
export interface InputTape {
  cells: string[];
  centres: number[];
  movers: string[];
}

export interface AutomatonPresentInput {
  spec: VisualSpec;
  automaton: Automaton;
  trace: AutomatonTrace;
  word: string[];
  style: AutomatonStyle;
  lang: string;
  tape?: InputTape;
}

// Appends the run as ordinary steps: Start, one step per symbol read, then the verdict with the ending states tinted.
// A read step also lights its cell and slides the head onto it, in the same step as the machine moves.
function tapeBlocks(tape: InputTape | undefined, index: number): BuilderBlock[] {
  if (!tape || index >= tape.cells.length) return [];
  return [...(index > 0 ? [block('calm', tape.cells[index - 1])] : []), block('highlight', tape.cells[index])];
}

function withHead(spec: VisualSpec, step: number, tape: InputTape | undefined, index: number): VisualSpec {
  if (!tape || index === 0 || index >= tape.cells.length || tape.movers.length === 0) return spec;
  return moveAtStep(spec, step, tape.movers, tape.centres[index] - tape.centres[index - 1], 0);
}

// Run steps carry a concept so a replace can remove them and keep the drawing's own setup steps.
export const AUTOMATA_RUN_CONCEPT = 'automata-run';
const markLastAsRun = (spec: VisualSpec): VisualSpec => {
  const last = spec.steps.length - 1;
  return { ...spec, steps: spec.steps.map((step, index) => (index === last ? { ...step, concept: AUTOMATA_RUN_CONCEPT } : step)) };
};

export function presentAutomatonTrace({ spec, automaton, trace, word, style, lang, tape }: AutomatonPresentInput): VisualSpec {
  let reads = 0;
  const names = (ids: string[]): string => ids.map((id) => automaton.states.find((state) => state.id === id)?.label ?? id).join(', ');
  const wordText = word.join('');

  const stepFor = (current: VisualSpec, event: AutomatonEvent): VisualSpec => {
    if (event.type === 'start') {
      return appendStep(current, algorithmText(style.captions.start, lang, { states: names(event.states) }), event.states.map((id) => block('highlight', id)));
    }
    if (event.type === 'read') {
      const values = { symbol: event.symbol, from: names(event.from), to: names(event.to) };
      const blocks = [...event.from.map((id) => block('calm', id)), ...event.moves.map((id) => block('highlight', id)), ...event.to.map((id) => block('highlight', id)), ...tapeBlocks(tape, reads)];
      const stepped = appendStep(current, algorithmText(style.captions.read, lang, values), blocks, algorithmText(style.whys.read, lang, values));
      const last = stepped.steps.length - 1;
      const travelled = event.moves.reduce((acc, move) => addEffectAtStart(acc, last, 'travel', move), stepped);
      const moved = withHead(travelled, last, tape, reads);
      reads += 1;
      return moved;
    }
    const values = { states: names(event.states), symbol: event.stuckOn ?? '', word: wordText };
    const key = event.verdict;
    const color = key === 'accept' ? style.colors.accept : style.colors.reject;
    const blocks = [...event.states.map((id) => block('highlight', id)), ...event.states.map((id) => tint(id, color))];
    return appendStep(current, algorithmText(style.captions[key], lang, values), blocks, algorithmText(style.whys[key], lang, values));
  };

  return trace.reduce((current, event) => markLastAsRun(stepFor(current, event)), spec);
}

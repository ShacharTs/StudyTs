import type { VisualSpec } from '../../types/visualSpec';
import { buildTemplate, templateByRef } from '../diagramPacks/buildTemplate';
import { readAutomaton, symbolsOf } from '../domains/automaton/automatonModel';
import { runAutomatonWord } from '../domains/runAutomatonWord';
import { automatonAlgorithmById } from '../domains/algorithmRegistry';
import { runAutomaton } from '../domains/automaton/runAutomaton';
import { AUTOMATA_RUN_CONCEPT } from '../domains/automaton/automatonPresenter';
import { setTape, tapeText } from './tapeTools';

export { readAutomaton } from '../domains/automaton/automatonModel';
export type { Automaton, AutomatonMove, AutomatonState } from '../domains/automaton/automatonModel';

const DEFAULT_RUN = 'automata/run';
export const MAX_WORD_LENGTH = 24;

export function parseWord(text: string): string[] {
  const trimmed = text.trim();
  if (trimmed === '') return [];
  const tokens = /[\s,]/.test(trimmed) ? symbolsOf(trimmed) : [...trimmed];
  return tokens.slice(0, MAX_WORD_LENGTH);
}

// The word is a tape along the top of the drawing, so the input is seen as cells and the head reads them while the machine steps.
const TAPE_AT_TOP = { row: 0.15, maxCell: 40 };

export const readWord = (spec: VisualSpec): string => tapeText(spec);

export function setWord(spec: VisualSpec, text: string, lang = 'en'): VisualSpec {
  return setTape(spec, parseWord(text).map((symbol) => symbol.slice(0, 3)), 0, lang, TAPE_AT_TOP);
}

const STARTER_TEMPLATE = 'automata/automata-dfa-even-ones';
const STARTER_WORD = '0110';

// The starter is the lecture DFA with its input already on the tape, so the tape is there before anything is typed.
export function newAutomaton(spec: VisualSpec, lang = 'en'): VisualSpec {
  const template = templateByRef(STARTER_TEMPLATE);
  return template ? setWord(buildTemplate(template.def, lang), STARTER_WORD, lang) : spec;
}

// Runs the typed word with the automaton run spec and appends Start, one step per symbol and the verdict.
// A drawing with no states or an empty word is left alone.
export function runInput(spec: VisualSpec, lang = 'en'): VisualSpec {
  const word = parseWord(readWord(spec));
  return word.length === 0 ? spec : runAutomatonWord(spec, readAutomaton(spec), DEFAULT_RUN, word, lang);
}

export type AutoVerdict = { kind: 'accept' | 'reject' | 'noStart' | 'empty' } | { kind: 'stuck'; stuckOn: string };

// The live chip reads the word without drawing anything: the steps stay as the user left them until Run input.
export function autoVerdict(spec: VisualSpec): AutoVerdict {
  const word = parseWord(readWord(spec));
  if (word.length === 0) return { kind: 'empty' };
  const algorithm = automatonAlgorithmById(DEFAULT_RUN);
  const trace = algorithm ? runAutomaton(readAutomaton(spec), algorithm, word) : null;
  if (!trace) return { kind: 'noStart' };
  const end = trace[trace.length - 1];
  if (end.type !== 'verdict') return { kind: 'noStart' };
  if (end.verdict === 'stuck') return { kind: 'stuck', stuckOn: end.stuckOn ?? '' };
  return { kind: end.verdict === 'accept' ? 'accept' : 'reject' };
}

// Steps beyond the base step are what Replace would lose, so Run input asks before writing over any of them.
export function hasStepsBeyondBase(spec: VisualSpec): boolean {
  return spec.steps.length > 1;
}

const isRunStep = (step: VisualSpec['steps'][number]): boolean => step.concept === AUTOMATA_RUN_CONCEPT;

// Earlier runs are tagged and go; setup and hand-made steps stay. A starter with no tagged steps keeps only its base step.
function stepsToKeep(spec: VisualSpec): VisualSpec['steps'] {
  if (spec.steps.some(isRunStep)) return spec.steps.filter((step) => !isRunStep(step));
  return spec.steps.slice(0, 1);
}

// Replace keeps the elements where they are and rebuilds the tape. An empty word or no start state changes nothing.
export function runInputReplacing(spec: VisualSpec, lang = 'en'): VisualSpec {
  if (parseWord(readWord(spec)).length === 0) return spec;
  const kept = { ...spec, steps: stepsToKeep(spec) };
  const written = runInput(setWord(kept, readWord(spec), lang), lang);
  return written.steps.length === kept.steps.length ? spec : written;
}

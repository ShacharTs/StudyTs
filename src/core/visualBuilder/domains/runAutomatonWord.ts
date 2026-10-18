import type { VisualSpec } from '../../types/visualSpec';
import { automatonAlgorithmById } from './algorithmRegistry';
import { presentAutomatonTrace, automatonStyle, type InputTape } from './automaton/automatonPresenter';
import type { Automaton } from './automaton/automatonModel';
import { elementBox, boxCenter } from '../builderGeometry';
import { tapeParts } from '../modeTools/tapeTools';
import { runAutomaton } from './automaton/runAutomaton';

// The tape under the word, when one is drawn with exactly its symbols: its cells light up and its head moves as the machine reads.
function inputTape(spec: VisualSpec, length: number): InputTape | undefined {
  const { cells, head, headLabel } = tapeParts(spec);
  if (cells.length !== length || length === 0) return undefined;
  return { cells: cells.map((cell) => cell.id), centres: cells.map((cell) => boxCenter(elementBox(cell)).x), movers: [head, headLabel].flatMap((part) => (part ? [part.id] : [])) };
}

// Runs a word with the named automaton spec and appends the steps; an unknown spec or a drawing with no start state is left alone.
export function runAutomatonWord(spec: VisualSpec, automaton: Automaton, algorithmId: string, word: string[], lang = 'en'): VisualSpec {
  const algorithm = automatonAlgorithmById(algorithmId);
  const trace = algorithm ? runAutomaton(automaton, algorithm, word) : null;
  return trace ? presentAutomatonTrace({ spec, automaton, trace, word, style: automatonStyle(), lang, tape: inputTape(spec, word.length) }) : spec;
}

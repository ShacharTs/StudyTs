import type { VisualElementSpec, VisualSpec } from '../../../types/visualSpec';
import { isOwner } from '../../builderEdits';
import { boxCenter, elementBox } from '../../builderGeometry';
import { shapeText } from '../../modeTools/shapeText';

export const STATE_REF = 'automata/state';
export const ACCEPTING_REF = 'automata/accepting-state';
export const START_REF = 'automata/start-marker';
export const STATE_REFS = [STATE_REF, ACCEPTING_REF];

// A move that reads no symbol; the machine may take it at any time.
export const EPSILON_SYMBOLS: readonly string[] = ['ε', 'eps'];

export interface AutomatonState {
  id: string;
  label: string;
  accepting: boolean;
}

export interface AutomatonMove {
  id: string;
  from: string;
  to: string;
  symbols: string[];
}

export interface Automaton {
  states: AutomatonState[];
  start: string | null;
  moves: AutomatonMove[];
}

const owners = (spec: VisualSpec): VisualElementSpec[] => spec.elements.filter(isOwner);
const isState = (el: VisualElementSpec): boolean => STATE_REFS.includes(el.builder?.pack ?? '');
export const symbolsOf = (text: string): string[] => text.split(/[,\s]+/).map((symbol) => symbol.trim()).filter(Boolean);

function startStateId(spec: VisualSpec, states: VisualElementSpec[]): string | null {
  const marker = owners(spec).find((el) => el.builder?.pack === START_REF);
  if (states.length === 0 || !marker) return null;
  const origin = boxCenter(elementBox(marker));
  const distance = (el: VisualElementSpec): number => Math.hypot(boxCenter(elementBox(el)).x - origin.x, boxCenter(elementBox(el)).y - origin.y);
  return states.reduce((best, el) => (distance(el) < distance(best) ? el : best)).id;
}

// Reads the drawing: states by pack object, the start state is the one nearest the start marker, moves are the links and their labels.
export function readAutomaton(spec: VisualSpec): Automaton {
  const stateEls = owners(spec).filter(isState);
  const known = new Set(stateEls.map((el) => el.id));
  const moves = spec.elements
    .filter((el) => el.builder?.link && known.has(el.builder.link.from) && known.has(el.builder.link.to))
    .map((el) => {
      const label = spec.elements.find((candidate) => candidate.id === `${el.id}-label`);
      return { id: el.id, from: el.builder!.link!.from, to: el.builder!.link!.to, symbols: symbolsOf((label?.content ?? '').replace(/[$\\]/g, '')) };
    });
  const states = stateEls.map((el) => ({ id: el.id, label: shapeText(spec, el) || el.id, accepting: el.builder?.pack === ACCEPTING_REF }));
  return { states, start: startStateId(spec, stateEls), moves };
}

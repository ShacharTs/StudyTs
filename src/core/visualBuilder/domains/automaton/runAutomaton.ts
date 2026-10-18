import { EPSILON_SYMBOLS, type Automaton, type AutomatonMove } from './automatonModel';
import type { AutomatonSpec } from './automatonSpec';

export type AutomatonEvent =
  | { type: 'start'; states: string[] }
  | { type: 'read'; symbol: string; from: string[]; moves: string[]; to: string[] }
  | { type: 'verdict'; verdict: 'accept' | 'reject' | 'stuck'; states: string[]; stuckOn: string | null };

export type AutomatonTrace = AutomatonEvent[];

const reads = (move: AutomatonMove, symbol: string): boolean => move.symbols.includes(symbol);
const isEpsilon = (move: AutomatonMove): boolean => move.symbols.some((symbol) => EPSILON_SYMBOLS.includes(symbol));

// The states reachable from `states` by epsilon moves alone, the starting ones included.
function closure(automaton: Automaton, states: string[]): string[] {
  const seen = new Set(states);
  const queue = [...states];
  while (queue.length > 0) {
    const here = queue.shift() as string;
    automaton.moves
      .filter((move) => move.from === here && isEpsilon(move) && !seen.has(move.to))
      .forEach((move) => {
        seen.add(move.to);
        queue.push(move.to);
      });
  }
  return [...seen];
}

// The moves one symbol takes from a set of states: every enabled move, or only the first one when the spec asks for it.
function enabled(automaton: Automaton, spec: AutomatonSpec, from: string[], symbol: string): AutomatonMove[] {
  const all = automaton.moves.filter((move) => from.includes(move.from) && reads(move, symbol));
  return spec.choice === 'first' ? all.slice(0, 1) : all;
}

const accepting = (automaton: Automaton, states: string[]): boolean => automaton.states.some((state) => state.accepting && states.includes(state.id));

// Pure run of a word. An empty set of states is a dead machine: the run stops there as a reject on that symbol.
export function runAutomaton(automaton: Automaton, spec: AutomatonSpec, word: string[]): AutomatonTrace | null {
  if (!automaton.start) return null;
  let current = closure(automaton, [automaton.start]);
  const trace: AutomatonTrace = [{ type: 'start', states: current }];
  for (const symbol of word) {
    const moves = enabled(automaton, spec, current, symbol);
    if (moves.length === 0) {
      trace.push({ type: 'verdict', verdict: 'stuck', states: current, stuckOn: symbol });
      return trace;
    }
    const next = closure(automaton, [...new Set(moves.map((move) => move.to))]);
    trace.push({ type: 'read', symbol, from: current, moves: moves.map((move) => move.id), to: next });
    current = next;
  }
  trace.push({ type: 'verdict', verdict: accepting(automaton, current) ? 'accept' : 'reject', states: current, stuckOn: null });
  return trace;
}

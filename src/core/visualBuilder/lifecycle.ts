import type { VisualSpec } from '../types/visualSpec';
import { blocksOf } from './blocks';

export type Lifecycle = 'before' | 'live' | 'gone';

type LifeAction = 'show' | 'draw' | 'hide';

interface LifeEvent {
  step: number;
  action: LifeAction;
}

const LIFE_ACTIONS: readonly string[] = ['show', 'draw', 'hide'];

function eventsOn(spec: VisualSpec, id: string): LifeEvent[] {
  return spec.steps.flatMap((step, index) =>
    blocksOf(step)
      .filter((block) => block.target === id && LIFE_ACTIONS.includes(block.action))
      .map((block) => ({ step: index, action: block.action as LifeAction })),
  );
}

// A label follows its parent, so the parent's events count as its own.
function eventsOf(spec: VisualSpec, id: string): LifeEvent[] {
  const parent = spec.elements.find((el) => el.id === id)?.builder?.parent;
  const all = [...(parent ? eventsOn(spec, parent) : []), ...eventsOn(spec, id)];
  return all.sort((a, b) => a.step - b.step);
}

function stateAt(events: LifeEvent[], stepIndex: number): Lifecycle {
  if (events.length === 0) return 'live';
  const last = events.filter((event) => event.step <= stepIndex).pop();
  if (!last) return events[0].action === 'hide' ? 'live' : 'before';
  return last.action === 'hide' ? 'gone' : 'live';
}

// An arrow animates only by its own blocks, so its endpoints never change its state.
export function lifecycleAt(spec: VisualSpec, stepIndex: number): Map<string, Lifecycle> {
  return new Map(spec.elements.map((el) => [el.id, stateAt(eventsOf(spec, el.id), stepIndex)]));
}

// 1-based step numbers for the chip; undefined when the element never appears or is never removed.
export function lifecycleSteps(spec: VisualSpec, id: string): { appears?: number; removed?: number } {
  const events = eventsOf(spec, id);
  const appears = events.find((event) => event.action !== 'hide');
  const removed = events.find((event) => event.action === 'hide');
  return { appears: appears && events[0].action !== 'hide' ? appears.step + 1 : undefined, removed: removed ? removed.step + 1 : undefined };
}

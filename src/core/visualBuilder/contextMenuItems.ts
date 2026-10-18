import type { BuilderShape, LinkRoute, VisualSpec } from '../types/visualSpec';
import { hasLabel } from './builderEdits';
import type { Hit } from './hitTest';
import { isStateElement } from './domains/automaton/automatonFlags';
import { ACCEPTING_REF, readAutomaton } from './domains/automaton/automatonModel';

export type ContextTarget = { kind: 'canvas' } | { kind: 'shape' | 'link'; id: string };

export type ContextAction =
  | { type: 'add'; shape: BuilderShape }
  | { type: 'insert' }
  | { type: 'addLabel' }
  | { type: 'removeLabel' }
  | { type: 'connect' | 'animate' | 'duplicate' | 'delete' | 'reverse' }
  | { type: 'route'; route: LinkRoute }
  | { type: 'addState' | 'setStart' | 'toggleAccept' };

export interface ContextItem {
  label: string;
  action: ContextAction;
}

// Only the text objects people reach for mid-edit; every other shape lives in the Insert gallery.
const ADD_CHOICES: Array<[BuilderShape, string]> = [
  ['text', 'Add text'],
  ['caption', 'Add caption'],
];

const ROUTES: Array<[LinkRoute, string]> = [
  ['straight', 'Straight'],
  ['elbow', 'Elbow'],
  ['curve', 'Curve'],
];

const TEXT_KINDS = ['math', 'bubble', 'text'];

export function contextTargetOf(hit: Hit): ContextTarget {
  if (hit.kind === 'background') return { kind: 'canvas' };
  return { kind: hit.kind === 'link' ? 'link' : 'shape', id: hit.id };
}

function labelItem(has: boolean): ContextItem {
  return has ? { label: 'Remove label', action: { type: 'removeLabel' } } : { label: 'Add label', action: { type: 'addLabel' } };
}

// Start and accepting are flags on a state; several states may accept.
function stateFlagItems(spec: VisualSpec, id: string): ContextItem[] {
  const accepting = spec.elements.find((el) => el.id === id)?.builder?.pack === ACCEPTING_REF;
  const start = readAutomaton(spec).start === id;
  return [
    { label: start ? 'Remove start' : 'Make start', action: { type: 'setStart' } },
    { label: accepting ? 'Make not accepting' : 'Make accepting', action: { type: 'toggleAccept' } },
  ];
}

function shapeItems(spec: VisualSpec, id: string, stateFlags: boolean): ContextItem[] {
  const element = spec.elements.find((el) => el.id === id);
  if (!element) return [];
  const label = TEXT_KINDS.includes(element.kind) ? [] : [labelItem(hasLabel(spec, id))];
  const flags = stateFlags && isStateElement(element) ? stateFlagItems(spec, id) : [];
  return [
    ...flags,
    ...label,
    { label: 'Connect', action: { type: 'connect' } },
    { label: 'Animate', action: { type: 'animate' } },
    { label: 'Duplicate', action: { type: 'duplicate' } },
    { label: 'Delete', action: { type: 'delete' } },
  ];
}

function linkItems(spec: VisualSpec, id: string): ContextItem[] {
  if (!spec.elements.some((el) => el.id === id)) return [];
  const labelled = spec.elements.some((el) => el.id === `${id}-label`);
  return [
    { label: 'Reverse', action: { type: 'reverse' } },
    ...ROUTES.map(([route, label]): ContextItem => ({ label, action: { type: 'route', route } })),
    labelItem(labelled),
    { label: 'Animate', action: { type: 'animate' } },
    { label: 'Delete', action: { type: 'delete' } },
  ];
}

export function contextMenuItems(spec: VisualSpec, target: ContextTarget, stateFlags = false): ContextItem[] {
  if (target.kind === 'canvas') {
    const states: ContextItem[] = stateFlags ? [{ label: 'Add state', action: { type: 'addState' } }] : [];
    return [...states, ...ADD_CHOICES.map(([shape, label]): ContextItem => ({ label, action: { type: 'add', shape } })), { label: 'Insert object…', action: { type: 'insert' } }];
  }
  return target.kind === 'shape' ? shapeItems(spec, target.id, stateFlags) : linkItems(spec, target.id);
}

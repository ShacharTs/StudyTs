import type { VisualSpec } from '../../types/visualSpec';
import { setLinkLabel } from '../connectors';
import type { WorkspaceMode } from '../modes/workspaceMode';

export const labelCycleOf = (mode: WorkspaceMode): string[] => {
  const connect = mode.tools.find((tool) => tool.id === 'connect');
  return connect && connect.id === 'connect' ? (connect.labelCycle ?? []) : [];
};

const labelOf = (spec: VisualSpec, linkId: string): string => (spec.elements.find((el) => el.id === `${linkId}-label`)?.content ?? '').replace(/[$\\]/g, '').trim();

// Only a mode that asks for it labels a new arrow by itself (an automaton needs its symbol; a plain graph does not).
export const autoLabelCycleOf = (mode: WorkspaceMode): string[] => {
  const connect = mode.tools.find((tool) => tool.id === 'connect');
  return connect && connect.id === 'connect' && connect.autoLabel ? (connect.labelCycle ?? []) : [];
};

// A new transition takes the first symbol its source state does not read yet, so two arrows from one state differ.
export function labelNewTransition(spec: VisualSpec, linkId: string, cycle: string[]): VisualSpec {
  const link = spec.elements.find((el) => el.id === linkId)?.builder?.link;
  if (!link || cycle.length === 0) return spec;
  const used = new Set(spec.elements.filter((el) => el.id !== linkId && el.builder?.link?.from === link.from).map((el) => labelOf(spec, el.id)));
  return setLinkLabel(spec, linkId, cycle.find((symbol) => !used.has(symbol)) ?? cycle[0]);
}

// The next symbol in the mode's cycle; a label outside the cycle starts it again.
export function cycleTransitionLabel(spec: VisualSpec, linkId: string, cycle: string[]): VisualSpec {
  if (cycle.length === 0) return spec;
  const at = cycle.indexOf(labelOf(spec, linkId));
  return setLinkLabel(spec, linkId, cycle[(at + 1) % cycle.length]);
}

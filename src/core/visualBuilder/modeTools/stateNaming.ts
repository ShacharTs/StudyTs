import type { Point } from '../../geometry/geometryPrimitives';
import { parseViewBox } from '../../shared/stageSize';
import type { VisualSpec } from '../../types/visualSpec';
import { isOwner, setElementText } from '../builderEdits';
import { boxCenter, elementBox } from '../builderGeometry';

const STATE_REFS = ['automata/state', 'automata/accepting-state'];

const plain = (text: string | undefined): string => (text ?? '').replace(/[$\\]/g, '').trim();

// A new automaton state is born named with the lowest free `qN`, so no state is ever left unlabeled.
export function nameNewState(spec: VisualSpec, id: string): VisualSpec {
  const pack = spec.elements.find((el) => el.id === id)?.builder?.pack;
  if (!pack || !STATE_REFS.includes(pack)) return spec;
  const used = new Set(spec.elements.map((el) => plain(el.content)));
  let number = 0;
  while (used.has(`q${number}`)) number += 1;
  return setElementText(spec, id, `q${number}`);
}

const STATE_SPACING = 160;
const ROW_SPACING = 140;
const EDGE_MARGIN = 48;

const SAME_ROW = 40;

// A new state goes one step to the right on the lowest row of the machine; a full row continues below, from the left.
export function nextStatePoint(spec: VisualSpec, ref: string): Point | undefined {
  if (!STATE_REFS.includes(ref)) return undefined;
  const centres = spec.elements.filter((el) => isOwner(el) && STATE_REFS.includes(el.builder?.pack ?? '')).map((el) => boxCenter(elementBox(el)));
  if (centres.length === 0) return undefined;
  const view = parseViewBox(spec.viewBox);
  const rowY = Math.max(...centres.map((point) => point.y));
  const row = centres.filter((point) => rowY - point.y <= SAME_ROW);
  const right = row.reduce((best, point) => (point.x > best.x ? point : best));
  if (right.x + STATE_SPACING <= view.w - EDGE_MARGIN) return { x: right.x + STATE_SPACING, y: right.y };
  const below = { x: Math.min(...centres.map((point) => point.x)), y: rowY + ROW_SPACING };
  return below.y <= view.h - EDGE_MARGIN ? below : undefined;
}

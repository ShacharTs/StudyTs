import { useCallback, useState } from 'react';
import type { Point } from '@core/geometry/geometryPrimitives';
import type { VisualSpec } from '@core/types/visualSpec';
import { addShape, removeLabel, setElementText } from '@core/visualBuilder/builderEdits';
import type { BuilderMode, ModeEvent } from '@core/visualBuilder/builderMode';
import { reverseLink, setLinkLabel, setLinkRoute } from '@core/visualBuilder/connectors';
import { ACCEPTING_REF, STATE_REF, readAutomaton } from '@core/visualBuilder/domains/automaton/automatonModel';
import { clearStart, setAccepting, setStart } from '@core/visualBuilder/domains/automaton/automatonFlags';
import { addPackObjectAtStep } from '@core/visualBuilder/sceneEdits';
import { contextMenuItems, contextTargetOf, type ContextAction, type ContextTarget } from '@core/visualBuilder/contextMenuItems';
import type { Hit } from '@core/visualBuilder/hitTest';
import type { useVisualBuilder } from './useVisualBuilder';

interface OpenMenu {
  target: ContextTarget;
  at: Point;
}

interface ContextRun {
  spec: VisualSpec;
  b: ReturnType<typeof useVisualBuilder>;
  dispatch: (event: ModeEvent) => void;
  ui: { onEdit: () => void; onAnimate: () => void; onRemove: () => void; onDuplicate: () => void; onInsert: () => void };
}

type Runners = { [K in ContextAction['type']]: (action: Extract<ContextAction, { type: K }>, run: ContextRun, menu: OpenMenu) => void };

const DEFAULT_LABEL = 'Label';
const idOf = (menu: OpenMenu): string => (menu.target.kind === 'canvas' ? '' : menu.target.id);
const isLink = (menu: OpenMenu): boolean => menu.target.kind === 'link';

const RUNNERS: Runners = {
  add: (action, { spec, b }, menu) => {
    const added = addShape(spec, action.shape, menu.at);
    b.commit(added.spec);
    b.select(added.id);
  },
  insert: (_action, { ui }) => ui.onInsert(),
  addLabel: (_action, { spec, b }, menu) => b.commit(isLink(menu) ? setLinkLabel(spec, idOf(menu), DEFAULT_LABEL) : setElementText(spec, idOf(menu), DEFAULT_LABEL)),
  removeLabel: (_action, { spec, b }, menu) => b.commit(isLink(menu) ? setLinkLabel(spec, idOf(menu), '') : removeLabel(spec, idOf(menu))),
  connect: (_action, { dispatch }, menu) => dispatch({ type: 'startConnectFrom', id: idOf(menu) }),
  animate: (_action, { ui }) => ui.onAnimate(),
  duplicate: (_action, { ui }) => ui.onDuplicate(),
  delete: (_action, { ui }) => ui.onRemove(),
  reverse: (_action, { spec, b }, menu) => b.commit(reverseLink(spec, idOf(menu))),
  route: (action, { spec, b }, menu) => b.commit(setLinkRoute(spec, idOf(menu), action.route)),
  addState: (_action, { spec, b }, menu) => {
    const added = addPackObjectAtStep(spec, 0, STATE_REF, menu.at);
    if (!added) return;
    b.commit(added.spec);
    b.select(added.id);
  },
  setStart: (_action, { spec, b }, menu) => b.commit(readAutomaton(spec).start === idOf(menu) ? clearStart(spec) : setStart(spec, idOf(menu))),
  toggleAccept: (_action, { spec, b }, menu) => {
    const accepting = spec.elements.find((el) => el.id === idOf(menu))?.builder?.pack === ACCEPTING_REF;
    b.commit(setAccepting(spec, idOf(menu), !accepting));
  },
};

const runAction = (action: ContextAction, run: ContextRun, menu: OpenMenu) => (RUNNERS[action.type] as (a: ContextAction, r: ContextRun, m: OpenMenu) => void)(action, run, menu);

// The menu is only ever open in select mode, so no choice can leave a tool mode half-started.
export function useVisualBuilderContextMenu(run: ContextRun, mode: BuilderMode, stateFlags = false) {
  const [menu, setMenu] = useState<OpenMenu | null>(null);
  const close = useCallback(() => setMenu(null), []);

  const open = (hit: Hit, at: Point) => {
    if (mode.kind !== 'select') return;
    const target = contextTargetOf(hit);
    run.b.select(target.kind === 'canvas' ? null : target.id);
    setMenu({ target, at });
  };

  const choose = (action: ContextAction) => {
    if (menu) runAction(action, run, menu);
    close();
  };

  const visible = menu !== null && mode.kind === 'select' ? menu : null;
  const items = visible ? contextMenuItems(run.spec, visible.target, stateFlags) : [];
  return { menu: visible, items, open, choose, close };
}

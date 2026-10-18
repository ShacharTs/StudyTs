import { createElement, type CSSProperties, type ReactNode } from 'react';
import { Latex } from '../latex/Latex';
import { VISUAL_ID_ATTRIBUTE } from './buildStepTimeline';
import type { VisualElementSpec } from './visualSpec';
import styles from './GenericSvgStage.module.css';

function elementChildren(element: VisualElementSpec): ReactNode {
  const text = element.content ?? '';
  if (element.kind === 'text') return text;
  if (element.kind === 'math' || element.kind === 'bubble') {
    const className = element.kind === 'bubble' ? styles.bubble : styles.math;
    return createElement('div', { className, dir: 'auto' }, createElement(Latex, { text }));
  }
  return undefined;
}

// One spec element as an SVG node. `extra` props (event handlers, pointer-events) are used by the builder canvas.
export function renderStageElement(element: VisualElementSpec, extra?: Record<string, unknown>): ReactNode {
  const props = {
    key: element.id,
    [VISUAL_ID_ATTRIBUTE]: element.id,
    ...element.attrs,
    style: element.style as CSSProperties | undefined,
    ...extra,
  };
  const tag = element.kind === 'math' || element.kind === 'bubble' ? 'foreignObject' : element.kind;
  return createElement(tag, props, elementChildren(element));
}

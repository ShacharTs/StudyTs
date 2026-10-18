import { useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent } from 'react';
import type { EffectTone } from '@core/visualBuilder/effects';
import { dragTiming, nudgeTiming, type LaneDrag } from '@core/visualBuilder/laneEdits';
import { clipVariables } from './cssVariables';
import { MAGNET_PX, pixelScale, pxOf } from './timelineGeometry';
import styles from './TimelinePanel.module.css';

interface TimelineClipProps {
  label: string;
  icon: string;
  tone: EffectTone;
  target: string;
  at: number;
  duration: number;
  pxPerSec: number;
  selected: boolean;
  dimmed: boolean;
  onSelect: () => void;
  onTiming: (timing: { at: number; duration: number }) => void;
  onContextMenu: (x: number, y: number) => void;
}

const NARROW_PX = 72;

export function TimelineClip({ label, icon, tone, target, at, duration, pxPerSec, selected, dimmed, onSelect, onTiming, onContextMenu }: TimelineClipProps) {
  const root = useRef<HTMLDivElement>(null);
  const [live, setLive] = useState<{ at: number; duration: number } | null>(null);

  const onKeyDown = (event: ReactKeyboardEvent) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    onSelect();
    onTiming(nudgeTiming({ at, duration }, event.key, event.shiftKey));
  };

  // The clip follows the pointer and commits once on release.
  const startDrag = (event: ReactMouseEvent, kind: LaneDrag) => {
    event.preventDefault();
    event.stopPropagation();
    onSelect();
    const scale = root.current ? pixelScale(root.current) : 1;
    const startX = event.clientX;
    const timingAt = (pointer: MouseEvent) =>
      dragTiming(kind, { at, duration }, (((pointer.clientX - startX) / scale) / pxPerSec) * 1000, [], (MAGNET_PX / pxPerSec) * 1000);
    const onMove = (move: MouseEvent) => setLive(timingAt(move));
    const onUp = (up: MouseEvent) => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      setLive(null);
      onTiming(timingAt(up));
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const openMenu = (event: ReactMouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    onSelect();
    onContextMenu(event.clientX, event.clientY);
  };

  const shown = live ?? { at, duration };
  const narrow = pxOf(shown.duration, pxPerSec) < NARROW_PX;

  return (
    <div
      ref={root}
      className={styles.clip}
      role="listitem"
      tabIndex={0}
      aria-label={`${target}: ${label}`}
      onKeyDown={onKeyDown}
      onContextMenu={openMenu}
      data-tone={tone}
      data-selected={selected}
      data-dim={dimmed}
      data-dragging={live !== null}
      data-drag="start"
      title={`${target}: ${label}`}
      style={clipVariables(shown.at, shown.duration, pxPerSec)}
      onMouseDown={(event) => startDrag(event, 'start')}
    >
      <i className={styles.edgeStart} data-drag="trim-start" onMouseDown={(event) => startDrag(event, 'trim-start')} />
      {narrow && <span className={styles.clipIcon} aria-hidden="true">{icon}</span>}
      {!narrow && <b className={styles.clipTarget}>{target}</b>}
      {!narrow && <small className={styles.clipLabel}>{label}</small>}
      <i className={styles.edgeEnd} data-drag="length" onMouseDown={(event) => startDrag(event, 'length')} />
    </div>
  );
}

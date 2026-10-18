// src/engine/playback/SpeedMenu.tsx
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation, PLAYER_TEXT } from '../../i18n';
import styles from './SpeedMenu.module.css';

interface SpeedMenuProps {
  rate: number;
  rates: readonly number[];
  onSelect: (rate: number) => void;
}

const rateLabel = (rate: number) => `${rate}x`;

// Where focus goes for an arrow or Home/End key inside the open list; null leaves the key alone.
function nextIndex(key: string, current: number, last: number): number | null {
  if (key === 'ArrowDown') return Math.min(current + 1, last);
  if (key === 'ArrowUp') return Math.max(current - 1, 0);
  if (key === 'Home') return 0;
  if (key === 'End') return last;
  return null;
}

export function SpeedMenu({ rate, rates, onSelect }: SpeedMenuProps) {
  const { val } = useTranslation();
  const label = val(PLAYER_TEXT.speedLabel);
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    list.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus();
    const closeOnOutside = (event: MouseEvent) => {
      if (!wrap.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutside);
    return () => document.removeEventListener('mousedown', closeOnOutside);
  }, [open]);

  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };

  const choose = (value: number) => {
    close();
    onSelect(value);
  };

  const onListKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    const items = Array.from(list.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') ?? []);
    const current = items.findIndex((item) => item === document.activeElement);
    const next = nextIndex(event.key, current, items.length - 1);
    if (next === null) return;
    event.preventDefault();
    items[next]?.focus();
  };

  const onTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'ArrowDown') return;
    event.preventDefault();
    setOpen(true);
  };

  return (
    <div ref={wrap} className={styles.wrap}>
      <button
        ref={trigger}
        type="button"
        id="speed-selector"
        className={`ib ${styles.trigger}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${label} ${rateLabel(rate)}`}
        onClick={() => setOpen((was) => !was)}
        onKeyDown={onTriggerKeyDown}
      >
        {rateLabel(rate)}
      </button>
      {open && (
        <div ref={list} role="menu" aria-label={label} className={styles.menu} onKeyDown={onListKeyDown}>
          {rates.map((value) => (
            <button
              key={value}
              type="button"
              role="menuitemradio"
              aria-checked={value === rate}
              className={styles.item}
              onClick={() => choose(value)}
            >
              {rateLabel(value)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

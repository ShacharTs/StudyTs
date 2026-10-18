import type { CSSProperties } from 'react';
import styles from './ModeMenu.module.css';

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 2.5 } as const;
const delay = (seconds: number): CSSProperties => ({ ['--delay' as string]: `${seconds}s` });

const DEMOS: Record<string, JSX.Element> = {
  free: (
    <>
      <circle className={styles.demoPulse} cx="26" cy="27" r="12" {...stroke} />
      <rect className={styles.demoPulse} style={delay(0.4)} x="48" y="15" width="24" height="24" rx="4" {...stroke} />
      <path className={styles.demoPulse} style={delay(0.8)} d="M 96 13 L 108 27 L 96 41 L 84 27 Z" {...stroke} />
    </>
  ),
  venn: (
    <>
      <circle className={styles.demoPulse} cx="48" cy="27" r="18" {...stroke} />
      <circle className={styles.demoPulse} style={delay(0.5)} cx="72" cy="27" r="18" {...stroke} />
      <circle className={styles.demoBlink} cx="60" cy="27" r="3" fill="currentColor" />
    </>
  ),
  graph: (
    <>
      <path d="M 30 14 L 60 40 M 60 40 L 90 14" {...stroke} strokeWidth={2} opacity={0.5} />
      {[[30, 14, 0], [60, 40, 0.5], [90, 14, 1]].map(([x, y, at]) => (
        <circle key={`${x}-${y}`} className={styles.demoLight} style={delay(at)} cx={x} cy={y} r="8" {...stroke} />
      ))}
    </>
  ),
  tape: (
    <>
      {[16, 36, 56, 76, 96].map((x) => (
        <rect key={x} x={x} y="24" width="18" height="18" rx="3" {...stroke} strokeWidth={2} />
      ))}
      <path className={styles.demoSlide} d="M 18 8 L 34 8 L 26 20 Z" fill="currentColor" />
    </>
  ),
  automata: (
    <>
      <circle cx="34" cy="27" r="13" {...stroke} />
      <circle cx="86" cy="27" r="13" {...stroke} />
      <circle cx="86" cy="27" r="8" {...stroke} strokeWidth={1.5} />
      <path d="M 47 27 L 73 27" {...stroke} strokeWidth={2} opacity={0.5} />
      <circle className={styles.demoTravel} cx="47" cy="27" r="4" fill="currentColor" />
    </>
  ),
  network: (
    <>
      <path d="M 60 27 L 20 12 M 60 27 L 20 42 M 60 27 L 100 27" {...stroke} strokeWidth={2} opacity={0.5} />
      <rect x="48" y="17" width="24" height="20" rx="4" {...stroke} />
      <rect x="8" y="5" width="16" height="14" rx="3" {...stroke} strokeWidth={2} />
      <rect x="8" y="35" width="16" height="14" rx="3" {...stroke} strokeWidth={2} />
      <rect x="96" y="20" width="16" height="14" rx="3" {...stroke} strokeWidth={2} />
      <circle className={styles.demoPacket} cx="60" cy="27" r="4" fill="currentColor" />
    </>
  ),
  diagrams: (
    <>
      {[8, 46, 84].map((x, index) => (
        <rect key={x} className={styles.demoLight} style={delay(index * 0.5)} x={x} y="18" width="28" height="18" rx="4" {...stroke} />
      ))}
      <path d="M 36 27 L 46 27 M 74 27 L 84 27" {...stroke} strokeWidth={2} opacity={0.5} />
    </>
  ),
};

const FALLBACK = <circle className={styles.demoPulse} cx="60" cy="27" r="14" {...stroke} />;

// A looping picture of what the mode is about; a custom mode has no picture of its own, so it gets the generic pulse.
export function ModeDemo({ modeId }: { modeId: string }) {
  return (
    <svg className={styles.demo} viewBox="0 0 120 54" aria-hidden="true">
      {DEMOS[modeId] ?? FALLBACK}
    </svg>
  );
}

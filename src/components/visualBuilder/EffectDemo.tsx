import type { EffectId } from '@core/visualBuilder/effects';
import styles from './BuilderWorkbench.module.css';

const DEMOS: Record<EffectId, JSX.Element> = {
  fill: (
    <>
      <circle cx="60" cy="27" r="20" fill="none" stroke="currentColor" strokeWidth="3" />
      <rect className={styles.demoFill} x="40" y="7" width="40" height="40" fill="currentColor" opacity="0.5" />
    </>
  ),
  reveal: <circle className={styles.demoReveal} cx="60" cy="27" r="20" fill="none" stroke="currentColor" strokeWidth="3" />,
  remove: <circle className={styles.demoRemove} cx="60" cy="27" r="20" fill="none" stroke="currentColor" strokeWidth="3" />,
  draw: <path className={styles.demoDraw} d="M 14 40 L 106 14" stroke="currentColor" strokeWidth="4" fill="none" />,
  travel: (
    <>
      <path d="M 14 27 L 106 27" stroke="currentColor" strokeWidth="3" />
      <circle className={styles.demoTravel} cx="16" cy="27" r="7" fill="currentColor" />
    </>
  ),
  flow: <path className={styles.demoFlow} d="M 14 27 L 106 27" stroke="currentColor" strokeWidth="4" fill="none" />,
  spark: <path className={styles.demoZig} d="M 12 27 L 24 15 L 36 39 L 48 15 L 60 39 L 72 15 L 84 39 L 96 15 L 108 27" stroke="currentColor" strokeWidth="3" fill="none" />,
  frame: (
    <>
      <rect x="36" y="8" width="48" height="38" rx="6" fill="none" stroke="currentColor" strokeWidth="2" />
      <rect className={styles.demoOutline} x="30" y="3" width="60" height="48" rx="8" fill="none" stroke="currentColor" strokeWidth="2.5" />
    </>
  ),
  pulse: <circle className={styles.demoPulse} cx="60" cy="27" r="16" fill="none" stroke="currentColor" strokeWidth="3" />,
  glow: <circle className={styles.demoGlow} cx="60" cy="27" r="18" fill="none" stroke="currentColor" strokeWidth="3" />,
  sweep: (
    <>
      <rect x="30" y="10" width="60" height="34" rx="6" fill="none" stroke="currentColor" strokeWidth="2.5" />
      <rect className={styles.demoSweep} x="30" y="10" width="14" height="34" fill="currentColor" opacity="0.5" />
    </>
  ),
  callout: (
    <>
      <rect x="40" y="26" width="40" height="24" rx="5" fill="none" stroke="currentColor" strokeWidth="2.5" />
      <g className={styles.demoCallout}>
        <rect x="26" y="3" width="68" height="16" rx="5" fill="currentColor" opacity="0.55" />
      </g>
    </>
  ),
  fade: <circle cx="60" cy="27" r="20" fill="none" stroke="currentColor" strokeWidth="3" opacity="0.3" />,
  tint: <circle cx="60" cy="27" r="20" fill="none" stroke="var(--viz-orange)" strokeWidth="3" />,
  outline: <circle cx="60" cy="27" r="20" fill="none" stroke="currentColor" strokeWidth="7" />,
  soften: <circle cx="60" cy="27" r="20" fill="currentColor" fillOpacity="0.25" stroke="currentColor" strokeWidth="3" />,
  grow: <circle className={styles.demoGrow} cx="60" cy="27" r="16" fill="none" stroke="currentColor" strokeWidth="3" />,
  bounce: <circle className={styles.demoBounce} cx="60" cy="27" r="16" fill="none" stroke="currentColor" strokeWidth="3" />,
  move: (
    <>
      <circle cx="30" cy="27" r="14" fill="none" stroke="currentColor" strokeWidth="3" opacity="0.35" />
      <circle cx="82" cy="27" r="14" fill="none" stroke="currentColor" strokeWidth="3" />
    </>
  ),
};

// A pack effect has no hand-drawn picture, so it shows the generic ghost-and-shape demo.
export function EffectDemo({ effect }: { effect: EffectId }) {
  return (
    <svg viewBox="0 0 120 54" className={styles.demo} aria-hidden="true">
      {DEMOS[effect] ?? DEMOS.move}
    </svg>
  );
}

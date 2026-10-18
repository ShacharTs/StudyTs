import styles from './MarqueeOverlay.module.css';

interface MarqueeOverlayProps {
  rect: { x: number; y: number; w: number; h: number } | null;
}

export function MarqueeOverlay({ rect }: MarqueeOverlayProps) {
  if (!rect) return null;
  return (
    <div
      className={styles.marquee}
      data-testid="marquee-overlay"
      style={{
        left: `${rect.x}mm`,
        top: `${rect.y}mm`,
        width: `${rect.w}mm`,
        height: `${rect.h}mm`,
      }}
    />
  );
}

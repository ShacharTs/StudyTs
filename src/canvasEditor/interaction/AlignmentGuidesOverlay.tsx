import type { CSSProperties } from 'react';
import type { AlignmentGuide } from './alignmentGuides';
import { useAlignmentGuides } from './alignmentGuideStore';
import styles from './AlignmentGuidesOverlay.module.css';

interface AlignmentGuidesOverlayProps {
  pageId: string;
}

// A fresh [] per selector call would make the store snapshot unstable for React.
const NO_GUIDES: AlignmentGuide[] = [];

export function AlignmentGuidesOverlay({ pageId }: AlignmentGuidesOverlayProps) {
  const guides = useAlignmentGuides((s) => (s.pageId === pageId ? s.guides : NO_GUIDES));
  return (
    <>
      {guides.map((guide, index) => (
        <GuideLine key={`${guide.axis}-${guide.position}-${index}`} guide={guide} />
      ))}
    </>
  );
}

/** Label sits at the midpoint of the gap, on the same side as the guide line it describes. */
function labelStyle(guide: AlignmentGuide, gapMid: number): CSSProperties {
  return guide.axis === 'x' ? { top: `${gapMid}mm` } : { left: `${gapMid}mm` };
}

function GuideLine({ guide }: { guide: AlignmentGuide }) {
  const isVertical = guide.axis === 'x';
  const lineStyle = isVertical ? { left: `${guide.position}mm` } : { top: `${guide.position}mm` };
  const gapMid = guide.gap ? (guide.gap.from + guide.gap.to) / 2 : 0;
  return (
    <div className={`${styles.line} ${isVertical ? styles.vertical : styles.horizontal} print-hide`} style={lineStyle}>
      {guide.gap && (
        <span className={styles.label} style={labelStyle(guide, gapMid)}>
          {guide.gap.mm} mm
        </span>
      )}
    </div>
  );
}

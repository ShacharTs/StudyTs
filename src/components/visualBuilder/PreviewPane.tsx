import { forwardRef } from 'react';
import { BUILDER_TEXT, useTranslation } from '@i18n';
import { VisualStepPlayer, PreviewScrubber, type PartRange, type PlayheadStore } from '@engine/visualStepPlayer';
import type { VisualSpec } from '@core/types/visualSpec';
import { LayoutNotes, type LayoutIssueActions } from './LayoutNotes';
import { TextButton } from './controls/TextButton';
import { usePopOutPreview } from './previewChannel';
import styles from './BuilderWorkbench.module.css';

interface PreviewPaneProps {
  previewSpec: VisualSpec;
  layoutSpec: VisualSpec;
  stepIndex: number;
  onStepChange: (index: number) => void;
  scrubMs?: number | null;
  onProgress?: (ms: number) => void;
  stepMs?: number;
  part?: PartRange | null;
  loop?: boolean;
  playhead?: PlayheadStore;
  onPlayingChange?: (playing: boolean) => void;
  onScrub?: (ms: number) => void;
  onPart?: (part: PartRange | null) => void;
  playStepCount?: number;
  onLoop?: (loop: boolean) => void;
  issueActions?: LayoutIssueActions;
}

export const PreviewPane = forwardRef<HTMLElement, PreviewPaneProps>(function PreviewPane({ previewSpec, layoutSpec, stepIndex, onStepChange, scrubMs, onProgress, stepMs, playhead, onScrub, onPlayingChange, part, loop, onPart, onLoop, playStepCount, issueActions }, ref) {
  const { val } = useTranslation();
  const popOut = usePopOutPreview(previewSpec);
  return (
    <section className={styles.preview} aria-label={val(BUILDER_TEXT.cvLivePreview)} ref={ref}>
      <div className={styles.previewBar}>
        <TextButton label={val(BUILDER_TEXT.cvPopOut)} onClick={popOut} />
      </div>
      <div className={styles.previewStage}>
        <VisualStepPlayer spec={previewSpec} stepIndex={stepIndex} onStepChange={onStepChange} scrubMs={scrubMs} onProgress={onProgress} onPlayingChange={onPlayingChange} holdFrameZero part={part} loop={loop} playStepCount={playStepCount} belowStage={stepMs && onScrub && playhead ? <PreviewScrubber stepMs={stepMs} playhead={playhead} onScrub={onScrub} part={part ?? null} loop={Boolean(loop)} onPart={onPart} onLoop={onLoop} /> : undefined} />
      </div>
      <LayoutNotes spec={layoutSpec} actions={issueActions} />
    </section>
  );
});

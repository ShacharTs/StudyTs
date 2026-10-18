import type { ReactNode } from 'react';
import { useTranslation } from '@i18n';
import { BlurCommitInput } from '@components/shared/BlurCommitInput';
import { usePlayheadMs, type PlayheadStore } from '@engine/visualStepPlayer';
import { TextButton } from './controls/TextButton';
import styles from './TimelinePanel.module.css';

interface TimelineTransportProps {
  playhead: PlayheadStore;
  // The preview owns playback; this button only asks it to toggle, and its label follows the preview.
  playing: boolean;
  onPlay: () => void;
  // The step's play length, the same length the preview scrubber stops at.
  totalMs: number;
  // Step tabs, ghosts and step actions share this row with Play.
  steps: ReactNode;
  // The text of the selected callout clip; absent when the selected clip has no text to edit.
  clipText?: { value: string; onCommit: (text: string) => void };
}

// Edits on blur or Enter so one typing session is one undo step.
function ClipTextField({ value, onCommit }: { value: string; onCommit: (text: string) => void }) {
  const { val } = useTranslation();
  const text = val({ key: "visualAuthoring.timeline.calloutText" });
  return <BlurCommitInput className={styles.clipText} label={text} placeholder={text} value={value} onCommit={onCommit} />;
}

// A leaf, so the per-frame clock does not re-render the transport buttons.
function TimelineClock({ playhead, totalMs }: { playhead: PlayheadStore; totalMs: number }) {
  const { val } = useTranslation();
  const playheadMs = usePlayheadMs(playhead);
  return <span className={styles.time} aria-label={val({ key: 'visualAuthoring.timeline.playheadTime' })}>{val({ key: 'visualAuthoring.timeline.seconds' }).replace('{value}', `${(playheadMs / 1000).toFixed(2)} / ${(totalMs / 1000).toFixed(2)}`)}</span>;
}

export function TimelineTransport({ playhead, playing, onPlay, totalMs, steps, clipText }: TimelineTransportProps) {
  const { val } = useTranslation();
  return (
    <div className={styles.stepsRow}>
      <div className={styles.playGroup}>
        <TextButton label={val(playing ? { key: 'visualAuthoring.timeline.pause' } : { key: 'visualAuthoring.timeline.playStep' })} title={val({ key: playing ? 'visualAuthoring.timeline.playTitle' : 'visualAuthoring.timeline.playStepTitle' })} onClick={onPlay} />
        <TimelineClock playhead={playhead} totalMs={totalMs} />
      </div>
      <div className={styles.stepTools}>
        {steps}
        {clipText && <ClipTextField value={clipText.value} onCommit={clipText.onCommit} />}
      </div>
    </div>
  );
}

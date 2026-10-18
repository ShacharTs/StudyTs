// Width and height behind one button, so the selection row stays on one line.
import { useCallback, useRef, useState } from 'react';
import { BUILDER_TEXT, INSERT_GALLERY_TEXT, useTranslation } from '@i18n';
import { TextButton } from './controls/TextButton';
import { announcePopoverOpen, useClosesWhenAnotherOpens } from './exclusivePopover';
import popStyles from './CompactColorField.module.css';

const MIN_SIZE = 24;
const MAX_SIZE = 440;

const clampSize = (value: number): number => Math.min(MAX_SIZE, Math.max(MIN_SIZE, Math.round(value)));

interface SizeControlProps {
  width: number;
  height: number;
  onResize: (side: 'w' | 'h', size: number) => void;
}

// Typed sizes apply on blur or Enter, so a half-typed number never resizes the shape.
function SizeRow({ label, side, size, onResize }: { label: string; side: 'w' | 'h'; size: number; onResize: (side: 'w' | 'h', size: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft !== null && draft.trim() !== '' && Number.isFinite(Number(draft))) onResize(side, clampSize(Number(draft)));
    setDraft(null);
  };
  return (
    <label className={popStyles.slider}>
      <span>{label}</span>
      <input type="range" min={MIN_SIZE} max={MAX_SIZE} value={Math.round(size)} onChange={(event) => onResize(side, Number(event.target.value))} aria-label={label} />
      <input
        type="number"
        className={popStyles.number}
        min={MIN_SIZE}
        max={MAX_SIZE}
        aria-label={`${label} px`}
        value={draft ?? Math.round(size)}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => event.key === 'Enter' && event.currentTarget.blur()}
      />
      <span>px</span>
    </label>
  );
}

export function SizeControl({ width, height, onResize }: SizeControlProps) {
  const { val } = useTranslation();
  const [open, setOpen] = useState(false);
  const owner = useRef({}).current;
  const close = useCallback(() => setOpen(false), []);
  useClosesWhenAnotherOpens(owner, close);
  const label = val(INSERT_GALLERY_TEXT.modeSize);
  return (
    <div className={popStyles.wrap}>
      <TextButton
        label={label}
        pressed={open}
        onClick={() => {
          if (!open) announcePopoverOpen(owner);
          setOpen(!open);
        }}
      />
      {open && (
        <div role="dialog" aria-label={label} className={popStyles.pop}>
          <SizeRow label={val(BUILDER_TEXT.edWidth)} side="w" size={width} onResize={onResize} />
          <SizeRow label={val(BUILDER_TEXT.edHeight)} side="h" size={height} onResize={onResize} />
        </div>
      )}
    </div>
  );
}

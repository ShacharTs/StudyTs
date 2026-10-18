// A row colour: one swatch of the current colour; it opens the colours this shape set uses most and an RGB picker.
import { useCallback, useRef, useState } from 'react';
import { announcePopoverOpen, useClosesWhenAnotherOpens } from './exclusivePopover';
import { COLOR_INPUT_FALLBACK } from '@core/theme/colorInputFallback';
import { COLOUR_PRESETS } from '@core/theme/colourPresets';
import { BUILDER_TEXT, useTranslation } from '@i18n';
import { cssVariable } from './cssVariables';
import styles from './VisualBuilder.module.css';
import popStyles from './CompactColorField.module.css';

interface CompactColorFieldProps {
  label: string;
  value?: string;
  usedColours: string[];
  onChange: (value: string) => void;
}

const isHex = (value: string | undefined): value is string => typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);

export function CompactColorField({ label, value, usedColours, onChange }: CompactColorFieldProps) {
  const { val } = useTranslation();
  const [open, setOpen] = useState(false);
  const owner = useRef({}).current;
  const close = useCallback(() => setOpen(false), []);
  useClosesWhenAnotherOpens(owner, close);
  const shown = value || COLOR_INPUT_FALLBACK;
  const pick = (next: string) => {
    onChange(next);
    setOpen(false);
  };
  return (
    <div className={popStyles.wrap}>
      <button
        type="button"
        className={styles.swatch}
        style={cssVariable('--swatch-color', shown)}
        aria-label={label}
        aria-expanded={open}
        onClick={() => {
          if (!open) announcePopoverOpen(owner);
          setOpen(!open);
        }}
      />
      {open && (
        <div role="dialog" aria-label={label} className={popStyles.pop}>
          <div className={popStyles.used}>
            {COLOUR_PRESETS.map((colour) => (
              <button key={colour} type="button" className={styles.swatch} style={cssVariable('--swatch-color', colour)} aria-label={colour} onClick={() => pick(colour)} />
            ))}
            {usedColours.map((colour) => (
              <button key={colour} type="button" className={styles.swatch} style={cssVariable('--swatch-color', colour)} aria-label={colour} onClick={() => pick(colour)} />
            ))}
          </div>
          <input
            type="color"
            className={styles.colorInput}
            aria-label={`${label}: ${val(BUILDER_TEXT.edCustomColor)}`}
            value={isHex(value) ? value : COLOR_INPUT_FALLBACK}
            onChange={(event) => onChange(event.target.value)}
          />
        </div>
      )}
    </div>
  );
}

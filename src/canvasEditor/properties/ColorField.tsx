import { useState, type ReactNode } from 'react';
import { toColorInputValue } from '../objectViews/themeColors';
import { useTranslation } from '@i18n';
import styles from './ColorField.module.css';

const HEX_PATTERN = /^#[0-9a-f]{6}$/i;

interface ColorFieldProps {
  id: string;
  value: string | undefined;
  onPick: (hex: string) => void;
  clear?: ReactNode;
}

/** Swatch plus hex text box; both report through the same pick handler. */
export function ColorField({ id, value, onPick, clear }: ColorFieldProps) {
  const hex = toColorInputValue(value);
  return (
    <span className={styles.colorField}>
      <input id={id} type="color" value={hex} onChange={(e) => onPick(e.target.value)} className={styles.swatch} />
      <HexInput key={hex} hex={hex} onPick={onPick} />
      {clear}
    </span>
  );
}

interface HexInputProps {
  hex: string;
  onPick: (hex: string) => void;
}

/** Keyed by the committed colour, so an outside change resets the draft without an effect. */
function HexInput({ hex, onPick }: HexInputProps) {
  const { val } = useTranslation();
  const [draft, setDraft] = useState(hex);
  const commit = () => {
    if (HEX_PATTERN.test(draft)) onPick(draft);
    else setDraft(hex);
  };
  return (
    <input
      type="text"
      className={styles.hexInput}
      value={draft}
      maxLength={7}
      aria-label={val({ key: 'canvasBlocks.properties.hex' })}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit();
      }}
    />
  );
}

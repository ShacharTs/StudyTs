import { useEffect, useRef } from 'react';
import { BUILDER_TEXT, useTranslation, type LocalizedText } from '@i18n';
import type { BuilderShape } from '@core/types/visualSpec';
import { pointVariables } from './cssVariables';
import { usePopoutFit } from './usePopoutFit';
import controlStyles from './controls/Controls.module.css';
import styles from './BuilderWorkbench.module.css';

interface QuickAddMenuProps {
  x: number;
  y: number;
  onChoose: (shape: BuilderShape) => void;
  onCancel: () => void;
}

const text = BUILDER_TEXT;

const CHOICES: Array<{ shape: BuilderShape; text: LocalizedText }> = [
  { shape: 'circle', text: text.cvCircle },
  { shape: 'box', text: text.cvBox },
  { shape: 'diamond', text: text.cvDiamond },
];

export function QuickAddMenu({ x, y, onChoose, onCancel }: QuickAddMenuProps) {
  const { val } = useTranslation();
  const first = useRef<HTMLButtonElement>(null);
  const root = useRef<HTMLDivElement>(null);
  usePopoutFit(root);
  useEffect(() => first.current?.focus(), []);
  return (
    <div
      ref={root}
      className={styles.quickAdd}
      style={pointVariables(x, y)}
      role="menu"
      aria-label={val(text.cvAddAndConnect)}
      onKeyDown={(event) => event.key === 'Escape' && onCancel()}
    >
      <small>{val(text.cvAddShapeHere)}</small>
      {CHOICES.map((choice, index) => (
        <button key={choice.shape} ref={index === 0 ? first : undefined} type="button" role="menuitem" className={controlStyles.menuItem} onClick={() => onChoose(choice.shape)}>
          {val(choice.text)}
        </button>
      ))}
    </div>
  );
}

import { ControlIcon, type ControlIconName } from './controlIcons';
import { controlClass, type ControlTone } from './controlClass';
import styles from './Controls.module.css';

interface IconButtonProps {
  icon: ControlIconName;
  label: string;
  shortcut?: string;
  pressed?: boolean;
  disabled?: boolean;
  tone?: ControlTone;
  onClick: () => void;
}

export function IconButton({ icon, label, shortcut, pressed, disabled, tone, onClick }: IconButtonProps) {
  return (
    <button type="button" className={controlClass(tone, styles.icon)} aria-label={label} title={shortcut ? `${label} (${shortcut})` : label} aria-pressed={pressed} disabled={disabled} onClick={onClick}>
      <ControlIcon name={icon} />
    </button>
  );
}

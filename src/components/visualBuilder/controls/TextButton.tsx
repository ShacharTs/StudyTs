import { ControlIcon, type ControlIconName } from './controlIcons';
import { controlClass, type ControlTone } from './controlClass';

export interface TextButtonProps {
  label: string;
  icon?: ControlIconName;
  shortcut?: string;
  title?: string;
  pressed?: boolean;
  disabled?: boolean;
  tone?: ControlTone;
  onClick: () => void;
}

export function TextButton({ label, icon, shortcut, title, pressed, disabled, tone, onClick }: TextButtonProps) {
  const hint = title ?? (shortcut ? `${label} (${shortcut})` : undefined);
  return (
    <button type="button" className={controlClass(tone)} title={hint} aria-pressed={pressed} disabled={disabled} onClick={onClick}>
      {icon && <ControlIcon name={icon} />}
      {label}
    </button>
  );
}

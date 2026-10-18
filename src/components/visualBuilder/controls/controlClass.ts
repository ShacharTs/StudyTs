import styles from './Controls.module.css';

export type ControlTone = 'neutral' | 'primary' | 'danger';

export const controlClass = (tone: ControlTone | undefined, extra?: string): string =>
  [styles.control, tone === 'primary' ? styles.primary : '', tone === 'danger' ? styles.danger : '', extra ?? ''].filter(Boolean).join(' ');

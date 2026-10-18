import type { ReactNode } from 'react';
import styles from './Controls.module.css';

// The divider marks the end of a group; a group whose neighbour is absent passes divider={false} so no line is left hanging.
export function ControlGroup({ label, children, divider = true }: { label: string; children: ReactNode; divider?: boolean }) {
  return (
    <div role="group" aria-label={label} className={divider ? styles.group : styles.groupPlain}>
      {children}
    </div>
  );
}

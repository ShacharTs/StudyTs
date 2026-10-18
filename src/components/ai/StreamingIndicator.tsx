// src/components/ai/StreamingIndicator.tsx
import styles from './StreamingIndicator.module.css';

export function StreamingIndicator() {
  return (
    <div className={styles.container} aria-hidden="true">
      <span className={styles.dot1} />
      <span className={styles.dot2} />
      <span className={styles.dot3} />
    </div>
  );
}

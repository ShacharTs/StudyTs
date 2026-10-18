/**
 * Loading indicator component displayed while dynamic TypeScript modules are loading.
 */

import React from 'react';
import styles from './PageLoading.module.css';

export const PageLoading: React.FC = () => {
  return (
    <div className={`unselectable ${styles.loadingContainer}`}>
      <div className={styles.spinner} />
      <div className={styles.loadingText}>Loading Visualization Module...</div>
    </div>
  );
};

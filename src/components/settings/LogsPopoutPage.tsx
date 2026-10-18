import React from 'react';
import { useTranslation } from '../../i18n';
import { LogViewer } from './LogViewer';
import styles from './LogsPopoutPage.module.css';

export const LogsPopoutPage: React.FC = () => {
  const { val } = useTranslation();

  return (
    <div className={styles.popoutContainer}>
      <LogViewer val={val} isPopout={true} />
    </div>
  );
};

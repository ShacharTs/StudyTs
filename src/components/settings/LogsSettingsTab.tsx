import React from 'react';
import type { TranslateFn } from '../../i18n';
import { LogViewer } from './LogViewer';
import styles from './LogsSettingsTab.module.css';

interface LogsSettingsTabProps {
  val: TranslateFn;
}

export const LogsSettingsTab: React.FC<LogsSettingsTabProps> = ({ val }) => {
  return (
    <div className={styles.tabContainer}>
      <LogViewer val={val} isPopout={false} />
    </div>
  );
};

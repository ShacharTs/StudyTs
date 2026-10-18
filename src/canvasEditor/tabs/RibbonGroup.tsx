import React from 'react';
import styles from './Ribbon.module.css';

interface RibbonGroupProps {
  label: string;
  children: React.ReactNode;
}

export function RibbonGroup({ label, children }: RibbonGroupProps) {
  return (
    <div className={styles.group}>
      <div className={styles.groupButtons}>{children}</div>
      <div className={styles.groupLabel}>{label}</div>
    </div>
  );
}

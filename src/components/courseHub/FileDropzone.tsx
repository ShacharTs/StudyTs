// src/components/courseHub/FileDropzone.tsx
/** The one button look for choosing files: a dashed drop zone with an upload icon, shared by every file picker. */
import React from 'react';
import { Upload } from 'lucide-react';
import styles from './FileDropzone.module.css';

interface FileDropzoneProps {
  label: string;
  accept: string;
  disabled?: boolean;
  onPick: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

export const FileDropzone: React.FC<FileDropzoneProps> = ({ label, accept, disabled = false, onPick }) => (
  <label className={`${styles.zone} ${disabled ? styles.disabled : ''}`}>
    <Upload size={18} aria-hidden="true" />
    <span className={styles.label}>{label}</span>
    <input hidden type="file" accept={accept} disabled={disabled} onChange={onPick} />
  </label>
);

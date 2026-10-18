import type { ChangeEvent } from 'react';
import styles from './VisualAuthoringToolbar.module.css';

interface SampleSelectProps {
  samples: Array<{ id: string; label: string }>;
  onLoadSample: (id: string) => void;
}

interface JsonTransferProps {
  onExport: () => void;
  onImportFile: (file: File) => void;
}

export function SampleSelect({ samples, onLoadSample }: SampleSelectProps) {
  return (
    <select
      aria-label="Load sample"
      className={styles.select}
      value=""
      onChange={(event) => event.target.value && onLoadSample(event.target.value)}
    >
      <option value="">Load sample…</option>
      {samples.map((sample) => (
        <option key={sample.id} value={sample.id}>
          {sample.label}
        </option>
      ))}
    </select>
  );
}

export function JsonTransfer({ onExport, onImportFile }: JsonTransferProps) {
  const handleImport = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) onImportFile(file);
  };

  return (
    <>
      <button type="button" className={styles.button} onClick={onExport}>
        Export JSON
      </button>
      <label className={styles.button}>
        Import JSON
        <input hidden type="file" accept="application/json,.json" aria-label="Import JSON file" onChange={handleImport} />
      </label>
    </>
  );
}

export function VisualAuthoringToolbar({ samples, onLoadSample, onExport, onImportFile }: SampleSelectProps & JsonTransferProps) {
  return (
    <div className={styles.toolbar}>
      <SampleSelect samples={samples} onLoadSample={onLoadSample} />
      <JsonTransfer onExport={onExport} onImportFile={onImportFile} />
    </div>
  );
}

import { useRef, useState } from 'react';
import { useCanvasStore, createDoc, isValidDocShape } from '@canvasStore';
import { SaveButton } from './SaveButton';
import { exportDocAsJson } from '../shell/exportDocAsJson';
import { requestPrint } from '../shell/requestPrint';
import { RibbonGroup } from './RibbonGroup';
import styles from './Ribbon.module.css';

export function FileRibbon() {
  const loadDoc = useCanvasStore((s) => s.loadDoc);
  const saveError = useCanvasStore((s) => s.saveError);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const newDoc = () => {
    if (!window.confirm('Start a new document? Unsaved changes will be lost.')) return;
    loadDoc(createDoc());
  };

  const exportDoc = () => {
    const { doc, sceneId } = useCanvasStore.getState();
    exportDocAsJson(doc, sceneId ?? 'canvas-document');
  };

  const triggerImport = () => {
    fileInputRef.current?.click();
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImportError(null);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed: unknown = JSON.parse(String(reader.result));
        if (!isValidDocShape(parsed)) {
          setImportError("This file isn't a valid canvas document.");
          return;
        }
        useCanvasStore.getState().loadDoc(parsed);
      } catch {
        setImportError("This file isn't a valid canvas document.");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className={styles.ribbon}>
      <RibbonGroup label="File">
        <button
          id="file-new"
          className={styles.buttonSmall}
          onClick={newDoc}
          title="New Document"
        >
          New
        </button>
        <SaveButton id="file-save" />
        <button
          id="file-export"
          className={styles.buttonSmall}
          onClick={exportDoc}
          title="Export"
        >
          Export
        </button>
        <button
          id="file-export-pdf"
          className={styles.buttonSmall}
          onClick={requestPrint}
          title="Export PDF (choose Save as PDF in the print dialog)"
        >
          Export PDF
        </button>
        <button
          id="file-import"
          className={styles.buttonSmall}
          onClick={triggerImport}
          title="Import"
        >
          Import
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          data-testid="file-import-input"
          className={styles.hiddenInput}
          onChange={handleImportFile}
        />
        {saveError && <span className={styles.errorText}>{saveError}</span>}
        {importError && <span className={styles.errorText}>{importError}</span>}
      </RibbonGroup>
    </div>
  );
}

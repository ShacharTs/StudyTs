import { useState } from 'react';
import { setProp, type SceneObject } from '@canvasStore';
import { renderLatex } from '@engine/latex';
import { fitFontSize } from './textFit';
import styles from './ObjectViews.module.css';

export function FormulaView({ obj }: { obj: SceneObject }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const p = obj.props;
  const latex = (p.latex as string) ?? '';
  const display = (p.display as boolean) ?? false;
  const fontSize = (p.fontSize as number) ?? 16;
  const fittedFontSize = fitFontSize(fontSize, obj.w, obj.h);

  const { html, error } = renderLatex(latex, display);
  const previewResult = renderLatex(draft, display);

  const commitLatex = (value: string) => {
    setProp(obj.id, 'latex', value, 'Edit formula');
    setEditing(false);
  };

  const startEditing = () => {
    setDraft(latex);
    setEditing(true);
  };

  return (
    <div className={styles.formulaRoot} style={{ '--fs': `${editing ? fontSize : fittedFontSize}px` } as React.CSSProperties}>
      {editing ? (
        <div className={styles.formulaEdit}>
          <textarea
            autoFocus
            value={draft}
            className={styles.formulaInput}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={(e) => commitLatex(e.target.value)}
          />
          <div
            data-testid="formula-live-preview"
            className={`${styles.formulaPreview} ${previewResult.error ? styles.formulaErr : ''}`}
            dangerouslySetInnerHTML={{ __html: previewResult.error ? `Invalid: ${draft}` : previewResult.html }}
          />
        </div>
      ) : (
        <div
          data-testid="formula-math"
          onDoubleClick={startEditing}
          className={`${styles.formulaMath} ${error ? styles.formulaErr : ''}`}
          dangerouslySetInnerHTML={{ __html: error ? `Invalid: ${latex}` : html }}
        />
      )}
    </div>
  );
}

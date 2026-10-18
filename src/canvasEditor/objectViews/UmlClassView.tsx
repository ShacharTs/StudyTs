import { useState } from 'react';
import { setProp, type SceneObject } from '@canvasStore';
import { themedColor } from './themeColors';
import styles from './UmlClassView.module.css';

function CompartmentEditor({
  value,
  onCommit,
  placeholder,
  multiline,
}: {
  value: string;
  onCommit: (v: string) => void;
  placeholder: string;
  multiline?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (editing) {
    const commonProps = {
      autoFocus: true,
      value: draft,
      onChange: (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => setDraft(e.target.value),
      onBlur: () => {
        onCommit(draft);
        setEditing(false);
      },
      className: styles.editorInput,
    };
    return multiline ? <textarea {...commonProps} rows={3} /> : <input {...commonProps} />;
  }

  return (
    <div
      className={styles.compartmentText}
      onDoubleClick={() => {
        setDraft(value);
        setEditing(true);
      }}
    >
      {value || <span className={styles.placeholder}>{placeholder}</span>}
    </div>
  );
}

export function UmlClassView({ obj }: { obj: SceneObject }) {
  const p = obj.props;
  const className = (p.className as string) ?? 'ClassName';
  const attributes = (p.attributes as string) ?? '';
  const methods = (p.methods as string) ?? '';
  const fill = (p.fill as string) ?? 'var(--bg-secondary)';
  const stroke = themedColor(p.stroke as string | undefined);

  return (
    <div className={styles.box} style={{ '--fill': fill, '--stroke': stroke } as React.CSSProperties}>
      <div className={styles.compartment} data-testid="uml-compartment">
        <CompartmentEditor
          value={className}
          onCommit={(v) => setProp(obj.id, 'className', v, 'Edit class name')}
          placeholder="ClassName"
        />
      </div>
      <div className={styles.compartment} data-testid="uml-compartment">
        {attributes.split('\n').filter(Boolean).map((line, i) => (
          <div key={i} className={styles.line}>{line}</div>
        ))}
        <CompartmentEditor
          value={attributes}
          onCommit={(v) => setProp(obj.id, 'attributes', v, 'Edit attributes')}
          placeholder="+ attribute: Type"
          multiline
        />
      </div>
      <div className={styles.compartment} data-testid="uml-compartment">
        {methods.split('\n').filter(Boolean).map((line, i) => (
          <div key={i} className={styles.line}>{line}</div>
        ))}
        <CompartmentEditor
          value={methods}
          onCommit={(v) => setProp(obj.id, 'methods', v, 'Edit methods')}
          placeholder="+ method(): ReturnType"
          multiline
        />
      </div>
    </div>
  );
}

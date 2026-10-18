import { BUILDER_TEXT, useTranslation } from '@i18n';
import { BlurCommitInput } from '@components/shared/BlurCommitInput';
import { pointVariables } from './cssVariables';
import styles from './BuilderWorkbench.module.css';

interface InlineTextEditorProps {
  x: number;
  y: number;
  initial: string;
  onCommit: (text: string) => void;
  onCancel: () => void;
  // Runs on every exit, including an unchanged blur, so the parent can always close the editor.
  onFinish: () => void;
}

export function InlineTextEditor({ x, y, initial, onCommit, onCancel, onFinish }: InlineTextEditorProps) {
  const { val } = useTranslation();
  return (
    <BlurCommitInput
      autoFocus
      selectOnFocus
      className={styles.inlineText}
      style={pointVariables(x, y)}
      label={val(BUILDER_TEXT.cvShapeText)}
      value={initial}
      onCommit={onCommit}
      onCancel={onCancel}
      onFinish={onFinish}
    />
  );
}

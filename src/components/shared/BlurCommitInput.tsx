import { useEffect, useRef, type CSSProperties, type KeyboardEvent, type MutableRefObject } from 'react';

type EditorElement = HTMLInputElement | HTMLTextAreaElement;

interface BlurCommitInputProps {
  value: string;
  onCommit: (value: string) => void;
  onFinish?: () => void;
  onChange?: (value: string) => void;
  onCancel?: () => void;
  multiline?: boolean;
  dir?: 'ltr' | 'rtl' | 'auto';
  className?: string;
  style?: CSSProperties;
  rows?: number;
  placeholder?: string;
  label?: string;
  autoFocus?: boolean;
  selectOnFocus?: boolean;
  inputRef?: MutableRefObject<EditorElement | null>;
}

// Re-keying on the value resets the uncontrolled field and its once-only guard when the value changes from elsewhere.
export function BlurCommitInput(props: BlurCommitInputProps) {
  return <CommitField key={props.value} {...props} />;
}

function CommitField(props: BlurCommitInputProps) {
  const { value, onCommit, onFinish, onChange, onCancel, multiline, label, selectOnFocus, inputRef, rows, ...appearance } = props;
  const local = useRef<EditorElement | null>(null);
  const done = useRef(false);

  const attach = (node: EditorElement | null) => {
    local.current = node;
    if (inputRef) inputRef.current = node;
  };

  useEffect(() => {
    if (selectOnFocus) local.current?.select();
  }, [selectOnFocus]);

  // Enter, Escape and blur can all fire for one edit; only the first one ends it.
  const finish = (next: string | null) => {
    if (done.current) return;
    done.current = true;
    if (next === null) onCancel?.();
    else if (next !== value) onCommit(next);
    onFinish?.();
  };

  const onKeyDown = (event: KeyboardEvent<EditorElement>) => {
    if (event.key === 'Escape' && onCancel) finish(null);
    // Enter ends a single-line edit through blur, so one commit path serves both keys.
    else if (event.key === 'Enter' && !multiline) event.currentTarget.blur();
  };

  const shared = {
    ...appearance,
    ref: attach,
    'aria-label': label,
    defaultValue: value,
    onChange: (event: { target: { value: string } }) => onChange?.(event.target.value),
    onBlur: (event: { currentTarget: { value: string } }) => finish(event.currentTarget.value),
    onKeyDown,
  };

  return multiline ? <textarea {...shared} rows={rows} /> : <input {...shared} />;
}

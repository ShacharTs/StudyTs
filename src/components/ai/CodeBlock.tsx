// src/components/ai/CodeBlock.tsx
import { useState, useEffect } from 'react';
import { Copy, Check, AlertCircle } from 'lucide-react';
import { AI_TEXT } from '../../i18n/dictionary';
import styles from './CodeBlock.module.css';

const COPY_FEEDBACK_MS = 2000;

interface CodeBlockProps {
  code: string;
  language?: string;
  val: (input?: unknown) => string;
}

export function CodeBlock({ code, language = '', val }: CodeBlockProps) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');

  useEffect(() => {
    if (copyState === 'idle') return;
    const timer = setTimeout(() => setCopyState('idle'), COPY_FEEDBACK_MS);
    return () => clearTimeout(timer);
  }, [copyState]);

  const handleCopy = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(code);
        setCopyState('copied');
      } else {
        setCopyState('error');
      }
    } catch {
      setCopyState('error');
    }
  };

  const copyLabel =
    copyState === 'copied'
      ? val(AI_TEXT.copied)
      : copyState === 'error'
        ? val(AI_TEXT.copyFailed)
        : val(AI_TEXT.copyCode);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.language}>{language || 'CODE'}</span>
        <button
          type="button"
          className={styles.copyBtn}
          onClick={handleCopy}
          aria-label={copyLabel}
          aria-live="polite"
        >
          {copyState === 'copied' ? (
            <Check size={12} color="var(--accent-green, #4ade80)" />
          ) : copyState === 'error' ? (
            <AlertCircle size={12} color="var(--accent-danger, #ef7a6d)" />
          ) : (
            <Copy size={12} />
          )}
          <span>{copyLabel}</span>
        </button>
      </div>

      <pre className={styles.pre} dir="ltr">
        <code className={styles.code} dir="ltr">
          {code}
        </code>
      </pre>
    </div>
  );
}

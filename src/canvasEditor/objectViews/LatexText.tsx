import React from 'react';
import { splitDollarMathSegments, layoutMathSegments, renderLatex } from '@engine/latex';
import styles from '@engine/latex/Latex.module.css';

interface LatexTextProps {
  text: string;
  style?: React.CSSProperties;
  className?: string;
}

export function LatexText({ text, style, className }: LatexTextProps) {
  if (!text) return null;
  const segments = layoutMathSegments(splitDollarMathSegments(text));

  return (
    <span style={style} className={className}>
      {segments.map((seg, idx) => {
        if (seg.type === 'text') {
          return <React.Fragment key={idx}>{seg.content}</React.Fragment>;
        }
        const { html, error } = renderLatex(seg.content, !!seg.display);
        return (
          <span
            key={idx}
            className={seg.display ? styles.katexDisplay : styles.katexInline}
            dangerouslySetInnerHTML={{ __html: error ? `$${seg.content}$` : html }}
          />
        );
      })}
    </span>
  );
}

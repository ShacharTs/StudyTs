/**
 * KaTeX renderer component for mixed text and math expressions.
 * Supports:
 * - Block math delimiters: $$...$$ and \[...\]
 * - Inline math delimiters: $...$ and \(...\)
 * - Auto-detection of TeX commands when undelimited
 * - Markdown text formatting: #/##/###/#### headings, **bold**, *italic*, `code`, line breaks
 * - Full RTL / LTR isolation
 *
 * Delimiter/segment parsing lives in latexParser.ts (pure, no React).
 */

import React from 'react';
import katex from 'katex';
import { parseLatexSegments } from './latexParser';
import { dialectOptions, preprocessLatex } from './latexDialect';
import styles from './Latex.module.css';

/**
 * Inline markdown/HTML-ish token rendering for Latex text segments:
 * ***bold italic***, **bold**, *italic*, `code`, [label](url), colored <span>, highlight <mark>.
 */


const MARK_CLASSES: Record<string, string> = {
  definition: styles.markDefinition,
  warning: styles.markWarning,
  important: styles.markImportant,
  concept: styles.markConcept,
  note: styles.markNote,
};

const SAFE_URL_PREFIXES = ['http://', 'https://', 'mailto:', 'tel:', '/', '#'];

function isSafeUrl(url: string): boolean {
  const trimmed = url.trim().toLowerCase();
  return SAFE_URL_PREFIXES.some((prefix) => trimmed.startsWith(prefix));
}

// Longest/most specific delimiter patterns first to avoid premature matches
const TOKEN_SPLIT =
  /(\[\s*[^\]]+\s*\]\([^)]+\)|<span[^>]*>[^<]+<\/span>|<mark[^>]*>[^<]+<\/mark>|\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;

type Render = (tok: string, key: string) => React.ReactNode | null;
interface Rule {
  applies: (tok: string) => boolean;
  render: Render;
}

const wrapped = (marker: string, minLength: number) => (tok: string) =>
  tok.startsWith(marker) && tok.endsWith(marker) && tok.length > minLength;

const renderLink: Render = (tok, key) => {
  const match = tok.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
  if (!match) return null;
  const rawHref = match[2].trim();
  return (
    <a
      key={key}
      href={isSafeUrl(rawHref) ? rawHref : '#'}
      target="_blank"
      rel="noopener noreferrer"
      data-testid="latex-rendered-link"
      className={styles.link}
      onClick={(e) => e.stopPropagation()}
    >
      {match[1]}
    </a>
  );
};

const renderColorSpan: Render = (tok, key) => {
  const colorMatch =
    tok.match(/^<span[^>]*style="[^"]*color:\s*([^";]+)[^"]*"[^>]*>([^<]+)<\/span>$/) ||
    tok.match(/^<span[^>]*data-text-color="([^"]+)"[^>]*>([^<]+)<\/span>$/);
  if (!colorMatch) return null;
  return (
    <span key={key} className={styles.colorSpan} style={{ color: colorMatch[1] }}>
      {colorMatch[2]}
    </span>
  );
};

const renderMark: Render = (tok, key) => {
  const markMatch = tok.match(/^<mark[^>]*data-highlight-kind="([^"]+)"[^>]*>([^<]+)<\/mark>$/);
  if (!markMatch) return null;
  const kind = markMatch[1];
  return (
    <mark key={key} data-highlight-kind={kind} className={`${styles.mark} ${MARK_CLASSES[kind] ?? MARK_CLASSES.definition}`}>
      {markMatch[2]}
    </mark>
  );
};

const RULES: Rule[] = [
  {
    applies: wrapped('***', 6),
    render: (tok, key) => (
      <strong key={key} className={styles.strongText}>
        <em>{tok.slice(3, -3)}</em>
      </strong>
    ),
  },
  {
    applies: wrapped('**', 4),
    render: (tok, key) => (
      <strong key={key} className={styles.strongText}>
        {tok.slice(2, -2)}
      </strong>
    ),
  },
  { applies: wrapped('*', 2), render: (tok, key) => <em key={key}>{tok.slice(1, -1)}</em> },
  {
    applies: wrapped('`', 2),
    render: (tok, key) => (
      <code key={key} className={styles.codeInline}>
        {tok.slice(1, -1)}
      </code>
    ),
  },
  { applies: (tok) => tok.startsWith('[') && tok.endsWith(')'), render: renderLink },
  { applies: (tok) => tok.startsWith('<span') && tok.endsWith('</span>'), render: renderColorSpan },
  { applies: (tok) => tok.startsWith('<mark') && tok.endsWith('</mark>'), render: renderMark },
];

function renderToken(tok: string, key: string): React.ReactNode {
  // The first rule whose delimiters fit wins; a rule that cannot parse its token leaves it literal.
  return RULES.find((rule) => rule.applies(tok))?.render(tok, key) ?? <React.Fragment key={key}>{tok}</React.Fragment>;
}

function renderInlineTokens(line: string, keyPrefix: string): React.ReactNode[] {
  return line
    .split(TOKEN_SPLIT)
    .map((tok, idx) => (tok ? renderToken(tok, `${keyPrefix}-t${idx}`) : null))
    .filter((node) => node !== null);
}

interface LatexProps {
  text: string;
  className?: string;
  style?: React.CSSProperties;
  // Canvas labels show their text literally; markdown is only for lesson prose.
  disableMarkdown?: boolean;
}

const HEADING_CLASSES: Record<number, string> = {
  1: styles.heading1,
  2: styles.heading2,
  3: styles.heading3,
  4: styles.heading4,
};

function renderTextWithMarkdown(content: string, keyPrefix: string): React.ReactNode[] {
  const lines = content.split('\n');
  const nodes: React.ReactNode[] = [];

  lines.forEach((line, lineIdx) => {
    if (lineIdx > 0) {
      nodes.push(<br key={`${keyPrefix}-br-${lineIdx}`} />);
    }

    if (!line) return;

    const headingMatch = line.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const headingText = headingMatch[2];
      nodes.push(
        <span
          key={`${keyPrefix}-h${level}-${lineIdx}`}
          data-heading-level={level}
          className={HEADING_CLASSES[level] || HEADING_CLASSES[4]}
        >
          {renderInlineTokens(headingText, `${keyPrefix}-h${level}-${lineIdx}`)}
        </span>
      );
      return;
    }

    nodes.push(...renderInlineTokens(line, `${keyPrefix}-l${lineIdx}`));
  });

  return nodes;
}

export const Latex: React.FC<LatexProps> = ({ text, className, style, disableMarkdown = false }) => {
  if (!text) return null;

  const segments = parseLatexSegments(text);

  return (
    <span className={`${styles.root} ${className || ''}`.trim()} dir="auto" style={style}>
      {segments.map((seg, i) => {
        if (seg.type === 'text') {
          return (
            <React.Fragment key={i}>
              {disableMarkdown ? seg.content : renderTextWithMarkdown(seg.content, `seg-${i}`)}
            </React.Fragment>
          );
        }

        try {
          const sanitized = seg.content.replace(/␣/g, '\\textvisiblespace');
          const html = katex.renderToString(preprocessLatex(sanitized), dialectOptions(seg.type === 'display'));
          return (
            <span
              key={i}
              dir="ltr"
              dangerouslySetInnerHTML={{ __html: html }}
              className={seg.type === 'display' ? styles.katexDisplay : styles.katexInline}
            />
          );
        } catch {
          return (
            <code key={i} dir="ltr" className={styles.fallbackCode}>
              {seg.content}
            </code>
          );
        }
      })}
    </span>
  );
};

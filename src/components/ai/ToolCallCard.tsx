import { useState } from 'react';
import { ChevronRight, Database, Layout, FileCode, Wrench } from 'lucide-react';
import type { DisplayMessage, ToolDetail } from '../../ai/chat/aiConnectionDefaults';
import styles from './ToolCallCard.module.css';

interface ToolCallCardProps {
  msg: DisplayMessage;
}

const TOOL_LINE_MAX_CHARS = 180;

function toolIconFor(name?: string, customClass?: string) {
  const cls = customClass || styles.toolIcon;
  if (!name) return <Wrench size={12} className={cls} />;
  if (/db|schema|topic/.test(name)) return <Database size={12} className={cls} />;
  if (/scene|canvas|diagram/.test(name)) return <Layout size={12} className={cls} />;
  if (/source|file/.test(name)) return <FileCode size={12} className={cls} />;
  return <Wrench size={12} className={cls} />;
}

function parseContentRows(content: unknown[]): Record<string, unknown>[] | null {
  const first = content[0] as Record<string, unknown> | undefined;
  if (typeof first?.text !== 'string') return null;
  try {
    const parsed = JSON.parse(first.text);
    return Array.isArray(parsed?.rows) ? (parsed.rows as Record<string, unknown>[]) : null;
  } catch {
    return null;
  }
}

function extractRows(data: unknown): Record<string, unknown>[] | null {
  if (!data || typeof data !== 'object') return null;
  const record = data as Record<string, unknown>;
  if (Array.isArray(record.rows)) return record.rows as Record<string, unknown>[];
  if (Array.isArray(record.content)) return parseContentRows(record.content);
  return null;
}

function SqlResultTable({ rows }: { rows: Record<string, unknown>[] }) {
  if (rows.length === 0) return <div>No matching rows</div>;
  const columns = Object.keys(rows[0] || {});
  const displayRows = rows.slice(0, 8);

  return (
    <div className={styles.tableWrapper}>
      <table className={styles.dataTable}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {displayRows.map((row, idx) => (
            <tr key={idx}>
              {columns.map((col) => (
                <td key={col}>{String(row[col] ?? '')}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > 8 && <div className={styles.duration}>...and {rows.length - 8} more rows</div>}
    </div>
  );
}

function ExpandedBody({ detail }: { detail: ToolDetail }) {
  const rows = extractRows(detail.resultData);

  return (
    <div className={styles.body}>
      {detail.sqlQuery && (
        <div className={styles.sqlSection}>
          <span className={styles.sqlTitle}>Executed SQL Query</span>
          <pre className={styles.sqlCode}>{detail.sqlQuery}</pre>
        </div>
      )}
      {rows && (
        <div className={styles.sqlSection}>
          <span className={styles.sqlTitle}>Query Results ({rows.length} rows)</span>
          <SqlResultTable rows={rows} />
        </div>
      )}
      {detail.error && (
        <div className={styles.sqlSection}>
          <span className={styles.errorTitle}>Error</span>
          <pre className={styles.sqlCode}>{detail.error}</pre>
        </div>
      )}
      {detail.rawArgs && Object.keys(detail.rawArgs).length > 0 ? (
        <details className={styles.rawDetails}>
          <summary>Parameters</summary>
          <pre>{JSON.stringify(detail.rawArgs, null, 2)}</pre>
        </details>
      ) : null}
      {detail.resultData && !rows ? (
        <details className={styles.rawDetails}>
          <summary>Result Data</summary>
          <pre>{JSON.stringify(detail.resultData, null, 2)}</pre>
        </details>
      ) : null}
    </div>
  );
}

function hasExecutionDetails(detail?: ToolDetail): boolean {
  if (!detail) return false;
  return Boolean(detail.sqlQuery || detail.rawArgs || detail.resultData || detail.error);
}

export function ToolCallCard({ msg }: ToolCallCardProps) {
  const [open, setOpen] = useState(false);
  const detail = msg.toolDetail;
  const isExpandable = hasExecutionDetails(detail);

  const short =
    msg.content.length > TOOL_LINE_MAX_CHARS ? `${msg.content.slice(0, TOOL_LINE_MAX_CHARS)}…` : msg.content;

  if (!isExpandable || !detail) {
    return (
      <div className="ai-message-item tool" dir="auto" title={msg.content}>
        {toolIconFor(msg.toolCallName, 'ai-tool-icon')}
        {short}
      </div>
    );
  }

  return (
    <div className={`ai-message-item tool ${styles.card}`} dir="auto">
      <div className={styles.header} onClick={() => setOpen((prev) => !prev)}>
        {toolIconFor(msg.toolCallName)}
        <span className={styles.summary} title={msg.content}>
          {short}
        </span>
        {detail.durationMs !== undefined && <span className={styles.duration}>{detail.durationMs}ms</span>}
        <ChevronRight size={12} className={`${styles.chevron} ${open ? styles.open : ''}`} />
      </div>
      {open && <ExpandedBody detail={detail} />}
    </div>
  );
}

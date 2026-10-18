import React, { useState, useEffect, useCallback, useRef } from 'react';
import { RefreshCw, ExternalLink, Copy, Check, Terminal, ArrowDown } from 'lucide-react';
import { SETTINGS_TEXT } from '../../i18n/dictionary';
import type { TranslateFn } from '../../i18n';
import styles from './LogViewer.module.css';

interface LogData {
  runId: string;
  activeFile: string;
  runLog: string;
  runtimeErrors: string;
  runs: string[];
}

interface LogViewerProps {
  val: TranslateFn;
  isPopout?: boolean;
}

type ViewMode = 'current' | 'errors' | 'runs';

interface LeftControlsProps {
  val: TranslateFn;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  selectedRun: string;
  setSelectedRun: (run: string) => void;
  runs?: string[];
}

const LeftControls: React.FC<LeftControlsProps> = ({
  val,
  viewMode,
  setViewMode,
  selectedRun,
  setSelectedRun,
  runs,
}) => (
  <div className={styles.leftControls}>
    <button
      type="button"
      className={`${styles.tabBtn} ${viewMode === 'current' ? styles.activeTabBtn : ''}`}
      onClick={() => setViewMode('current')}
    >
      <Terminal size={12} className={styles.terminalIcon} />
      {val(SETTINGS_TEXT.runLogsTab)}
    </button>
    <button
      type="button"
      className={`${styles.tabBtn} ${viewMode === 'errors' ? styles.activeTabBtn : ''}`}
      onClick={() => setViewMode('errors')}
    >
      {val(SETTINGS_TEXT.runtimeErrorsTab)}
    </button>
    {runs && runs.length > 0 && (
      <select
        value={selectedRun}
        onChange={(e) => setSelectedRun(e.target.value)}
        className={`${styles.searchInput} ${styles.runSelect}`}
      >
        <option value="">{val(SETTINGS_TEXT.allRunsTab)}</option>
        {runs.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
    )}
  </div>
);

interface RightControlsProps {
  val: TranslateFn;
  search: string;
  setSearch: (search: string) => void;
  autoRefresh: boolean;
  setAutoRefresh: (auto: boolean) => void;
  autoScroll: boolean;
  onToggleAutoScroll: () => void;
  loading: boolean;
  copied: boolean;
  onCopy: () => void;
  isPopout: boolean;
  onPopout: () => void;
}

const RightControls: React.FC<RightControlsProps> = ({
  val,
  search,
  setSearch,
  autoRefresh,
  setAutoRefresh,
  autoScroll,
  onToggleAutoScroll,
  loading,
  copied,
  onCopy,
  isPopout,
  onPopout,
}) => (
  <div className={styles.rightControls}>
    <input
      type="text"
      placeholder={val(SETTINGS_TEXT.searchLogs)}
      value={search}
      onChange={(e) => setSearch(e.target.value)}
      className={styles.searchInput}
    />
    <button
      type="button"
      className={`${styles.actionBtn} ${autoScroll ? styles.actionBtnActive : ''}`}
      onClick={onToggleAutoScroll}
      title={val(SETTINGS_TEXT.autoScrollLogs)}
    >
      <ArrowDown size={12} />
      {val(SETTINGS_TEXT.autoScrollLogs)}
    </button>
    <button
      type="button"
      className={`${styles.actionBtn} ${autoRefresh ? styles.actionBtnActive : ''}`}
      onClick={() => setAutoRefresh(!autoRefresh)}
      title={val(SETTINGS_TEXT.autoRefreshLogs)}
    >
      <RefreshCw size={12} className={loading ? 'spin' : ''} />
      {val(SETTINGS_TEXT.autoRefreshLogs)}
    </button>
    <button
      type="button"
      className={styles.actionBtn}
      onClick={onCopy}
      title={val(SETTINGS_TEXT.copyLogs)}
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? val(SETTINGS_TEXT.copiedLogs) : val(SETTINGS_TEXT.copyLogs)}
    </button>
    {!isPopout && (
      <button
        type="button"
        className={styles.actionBtn}
        onClick={onPopout}
        title={val(SETTINGS_TEXT.popoutLogs)}
      >
        <ExternalLink size={12} />
        {val(SETTINGS_TEXT.popoutLogs)}
      </button>
    )}
  </div>
);

function filterLogLines(content: string, search: string): string[] {
  if (!content) return [];
  if (!search) return content.split('\n');
  const term = search.toLowerCase();
  return content.split('\n').filter((line) => line.toLowerCase().includes(term));
}

function resolveActiveContent(data: LogData | null, mode: ViewMode): string {
  if (!data) return '';
  return mode === 'errors' ? data.runtimeErrors : data.runLog;
}

export const LogViewer: React.FC<LogViewerProps> = ({ val, isPopout = false }) => {
  const [data, setData] = useState<LogData | null>(null);
  const [selectedRun, setSelectedRun] = useState<string>('');
  const [viewMode, setViewMode] = useState<ViewMode>('current');
  const [search, setSearch] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [autoScroll, setAutoScroll] = useState(true);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  const logBoxRef = useRef<HTMLDivElement>(null);
  const userScrolledUpRef = useRef(false);

  const scrollToBottom = useCallback(() => {
    if (!logBoxRef.current) return;
    logBoxRef.current.scrollTop = logBoxRef.current.scrollHeight;
  }, []);

  const handleScroll = () => {
    if (!logBoxRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = logBoxRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 30;
    userScrolledUpRef.current = !isAtBottom;
  };

  const handleToggleAutoScroll = () => {
    const next = !autoScroll;
    setAutoScroll(next);
    if (next) {
      userScrolledUpRef.current = false;
      scrollToBottom();
    }
  };

  const fetchLogs = useCallback(async (runFile?: string) => {
    try {
      setLoading(true);
      const query = runFile ? `?run=${encodeURIComponent(runFile)}` : '';
      const res = await fetch(`/api/logs${query}`);
      if (!res.ok) return;
      const json = (await res.json()) as LogData;
      setData(json);
    } catch {
      // Backend offline or unreachable
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchLogs(selectedRun || undefined);
  }, [fetchLogs, selectedRun]);

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(() => {
      void fetchLogs(selectedRun || undefined);
    }, 2000);
    return () => clearInterval(timer);
  }, [autoRefresh, fetchLogs, selectedRun]);

  const content = resolveActiveContent(data, viewMode);
  const filteredLines = filterLogLines(content, search);

  useEffect(() => {
    if (autoScroll && !userScrolledUpRef.current) {
      scrollToBottom();
    }
  }, [filteredLines, autoScroll, scrollToBottom]);

  const handlePopout = () => {
    window.open('/logs', 'StudyTsLogs', 'width=960,height=680,resizable=yes,scrollbars=yes');
  };

  const handleCopy = () => {
    void navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className={styles.container}>
      <div className={styles.toolbar}>
        <LeftControls
          val={val}
          viewMode={viewMode}
          setViewMode={setViewMode}
          selectedRun={selectedRun}
          setSelectedRun={setSelectedRun}
          runs={data?.runs}
        />
        <RightControls
          val={val}
          search={search}
          setSearch={setSearch}
          autoRefresh={autoRefresh}
          setAutoRefresh={setAutoRefresh}
          autoScroll={autoScroll}
          onToggleAutoScroll={handleToggleAutoScroll}
          loading={loading}
          copied={copied}
          onCopy={handleCopy}
          isPopout={isPopout}
          onPopout={handlePopout}
        />
      </div>

      <div className={styles.logBox} ref={logBoxRef} onScroll={handleScroll}>
        {filteredLines.length > 0 ? (
          filteredLines.map((line, idx) => <div key={idx}>{line}</div>)
        ) : (
          <div className={styles.emptyNotice}>{val(SETTINGS_TEXT.noLogs)}</div>
        )}
      </div>
    </div>
  );
};

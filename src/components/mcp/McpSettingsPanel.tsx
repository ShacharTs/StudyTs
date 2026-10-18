import React from 'react';
import {
  Play,
  Square,
  RefreshCw,
  HelpCircle,
  Loader2,
  Cpu,
  Database,
  BookOpen,
  PenTool,
  Network,
  Bot,
  Zap,
} from 'lucide-react';
import { MCP_TEXT } from '../../i18n/dictionary';
import { useMcpManagement } from './useMcpManagement';
import '../../styles/mcpSettings.css';
import styles from './McpSettingsPanel.module.css';

interface McpSettingsPanelProps {
  val: (input?: unknown) => string;
  onOpenTutorial: () => void;
}

const NOTEBOOK_TOOLS = new Set(['save_note_to_notebook', 'search_notebook_notes', 'list_notebooks']);
const SQLITE_TOOLS = new Set(['read_course_database', 'show_database_tables', 'list_lectures']);
const AUTHOR_TOOLS = new Set([
  'list_courses',
  'create_course',
  'save_lecture_content',
  'add_lecture_to_course_list',
  'save_animated_lecture',
  'add_network_diagram_to_lecture',
]);

export const McpSettingsPanel: React.FC<McpSettingsPanelProps> = ({ val, onOpenTutorial }) => {
  const {
    servers,
    loading,
    actionLoading,
    error,
    startServer,
    stopServer,
    pingServer,
    deleteServer,
  } = useMcpManagement();

  return (
    <div className="mcp-panel">
      {/* Header */}
      <div className="mcp-header-row">
        <div>
          <div className="mcp-header-title">{val(MCP_TEXT.mcpTitle)}</div>
          <div className="mcp-header-desc">{val(MCP_TEXT.mcpSubtitle)}</div>
        </div>
        <div className="mcp-btn-row">
          <button type="button" className="mcp-btn" onClick={onOpenTutorial}>
            <HelpCircle size={13} /> {val(MCP_TEXT.tutorialBtn)}
          </button>
        </div>
      </div>

      {/* Interactive Architecture Explainer */}
      <div className={styles.architectureCard}>
        <div className={styles.architectureHeader}>
          <div className={styles.architectureTitle}>
            <Cpu size={14} color="var(--ac)" />
            {val(MCP_TEXT.howItWorksTitle)}
          </div>
          <span className={styles.architectureBadge}>100% Local · stdio JSON-RPC</span>
        </div>
        <div className={styles.architectureSteps}>
          <div className={styles.architectureStep}>
            <div className={styles.stepTitle}>
              <Bot size={13} color="var(--ac)" /> 1. {val(MCP_TEXT.architectureClient)}
            </div>
            <div className={styles.stepDesc}>{val(MCP_TEXT.architectureClientDesc)}</div>
          </div>
          <div className={styles.architectureStep}>
            <div className={styles.stepTitle}>
              <Zap size={13} color="var(--ac)" /> 2. {val(MCP_TEXT.architectureGateway)}
            </div>
            <div className={styles.stepDesc}>{val(MCP_TEXT.architectureGatewayDesc)}</div>
          </div>
          <div className={styles.architectureStep}>
            <div className={styles.stepTitle}>
              <Cpu size={13} color="var(--ac)" /> 3. {val(MCP_TEXT.architectureDaemon)}
            </div>
            <div className={styles.stepDesc}>{val(MCP_TEXT.architectureDaemonDesc)}</div>
          </div>
          <div className={styles.architectureStep}>
            <div className={styles.stepTitle}>
              <Database size={13} color="var(--ac)" /> 4. {val(MCP_TEXT.architectureStorage)}
            </div>
            <div className={styles.stepDesc}>{val(MCP_TEXT.architectureStorageDesc)}</div>
          </div>
        </div>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {/* Server Status & Controls */}
      {loading && servers.length === 0 ? (
        <div className={styles.statusRow}>
          <Loader2 size={14} className="animate-spin" /> Loading StudyTs-MCP...
        </div>
      ) : servers.length === 0 ? (
        <div className={styles.empty}>{val(MCP_TEXT.noServers)}</div>
      ) : (
        <div className="mcp-server-list">
          {servers
            .filter(
              (s, _idx, arr) =>
                !(
                  arr.some((other) => other.config.id === 'studyts-mcp') &&
                  (s.config.id === 'notebook-bridge' ||
                    s.config.id === 'sqlite-course-db' ||
                    s.config.id === 'course-author')
                )
            )
            .map((s) => {
            const isActing = actionLoading === s.config.id || actionLoading === `ping-${s.config.id}`;
            const notebookTools = s.tools.filter((t) => NOTEBOOK_TOOLS.has(t.name));
            const sqliteTools = s.tools.filter((t) => SQLITE_TOOLS.has(t.name));
            const authorTools = s.tools.filter((t) => AUTHOR_TOOLS.has(t.name));
            const otherTools = s.tools.filter(
              (t) => !NOTEBOOK_TOOLS.has(t.name) && !SQLITE_TOOLS.has(t.name) && !AUTHOR_TOOLS.has(t.name)
            );

            return (
              <div key={s.config.id} className="mcp-server-card">
                <div className="mcp-server-card-header">
                  <div className="mcp-server-name">
                    <span>{s.config.name}</span>
                    <span className={`mcp-status-pill ${s.status}`}>
                      {val(
                        MCP_TEXT[
                          `status${s.status.charAt(0).toUpperCase() + s.status.slice(1)}` as keyof typeof MCP_TEXT
                        ] || s.status
                      )}
                    </span>
                    {s.lastPingMs !== undefined && <span className={styles.ping}>({s.lastPingMs}ms)</span>}
                  </div>
                  <div className="mcp-btn-row">
                    {s.status === 'connected' ? (
                      <>
                        <button
                          type="button"
                          className="mcp-btn"
                          disabled={isActing}
                          onClick={() => pingServer(s.config.id)}
                          title={val(MCP_TEXT.ping)}
                        >
                          <RefreshCw
                            size={12}
                            className={actionLoading === `ping-${s.config.id}` ? 'animate-spin' : ''}
                          />
                        </button>
                        <button
                          type="button"
                          className="mcp-btn danger"
                          disabled={isActing}
                          onClick={() => stopServer(s.config.id)}
                        >
                          <Square size={12} /> {val(MCP_TEXT.stop)}
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="mcp-btn primary"
                        disabled={isActing}
                        onClick={() => startServer(s.config.id)}
                      >
                        <Play size={12} /> {val(MCP_TEXT.start)}
                      </button>
                    )}
                    {s.config.id !== 'studyts-mcp' && (
                      <button
                        type="button"
                        className="mcp-btn danger"
                        disabled={isActing}
                        onClick={() => deleteServer(s.config.id)}
                        title={val(MCP_TEXT.delete)}
                      >
                        <Square size={12} />
                      </button>
                    )}
                  </div>
                </div>

                <div
                  className="mcp-server-cmd"
                  title="Internal daemon managed automatically by StudyTs backend"
                >
                  <span className={styles.cmdBadge}>Internal Daemon</span>
                  <span className={styles.cmdCode}>
                    {s.config.command} {s.config.args.join(' ')}
                  </span>
                </div>

                {s.tools.length > 0 && (
                  <div>
                    <div className={styles.toolsHeading}>
                      {val(MCP_TEXT.activeTools)} ({s.tools.length}):
                    </div>

                    {notebookTools.length > 0 && (
                      <div className={styles.domainGroup}>
                        <div className={styles.domainTitle}>
                          <BookOpen size={11} color="var(--ac)" /> {val(MCP_TEXT.domainNotebooks)}:
                        </div>
                        <div className="mcp-server-tools-row">
                          {notebookTools.map((t) => (
                            <span key={t.name} className="mcp-tool-tag" title={t.description}>
                              {t.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {sqliteTools.length > 0 && (
                      <div className={styles.domainGroup}>
                        <div className={styles.domainTitle}>
                          <Database size={11} color="var(--ac)" /> {val(MCP_TEXT.domainDatabase)}:
                        </div>
                        <div className="mcp-server-tools-row">
                          {sqliteTools.map((t) => (
                            <span key={t.name} className="mcp-tool-tag" title={t.description}>
                              {t.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {authorTools.length > 0 && (
                      <div className={styles.domainGroup}>
                        <div className={styles.domainTitle}>
                          <PenTool size={11} color="var(--ac)" /> {val(MCP_TEXT.domainAuthoring)}:
                        </div>
                        <div className="mcp-server-tools-row">
                          {authorTools.map((t) => (
                            <span key={t.name} className="mcp-tool-tag" title={t.description}>
                              {t.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {otherTools.length > 0 && (
                      <div className={styles.domainGroup}>
                        <div className={styles.domainTitle}>
                          <Network size={11} color="var(--ac)" /> Additional Tools:
                        </div>
                        <div className="mcp-server-tools-row">
                          {otherTools.map((t) => (
                            <span key={t.name} className="mcp-tool-tag" title={t.description}>
                              {t.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

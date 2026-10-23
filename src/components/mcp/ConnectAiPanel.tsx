import React, { useState } from 'react';
import { Copy, Check, Plug, FolderOpen } from 'lucide-react';
import { MCP_TEXT } from '../../i18n/dictionary';
import { useConnectAi, type ClaudeCodeConnection, type ConnectClient, type ConnectOutcome } from './useConnectAi';
import styles from './ConnectAiPanel.module.css';

type Val = (input?: unknown) => string;

interface ConnectAiPanelProps {
  val: Val;
}

const CLAUDE_CODE_ID = 'claude-code';
const COPIED_RESET_MS = 2000;

type CopyState = 'idle' | 'copied' | 'failed';

function useCopy(text: string) {
  const [state, setState] = useState<CopyState>('idle');
  const copy = () => {
    navigator.clipboard.writeText(text).then(
      () => {
        setState('copied');
        setTimeout(() => setState('idle'), COPIED_RESET_MS);
      },
      () => setState('failed'),
    );
  };
  return { state, copy };
}

interface CodeBoxProps {
  label: string;
  text: string;
  val: Val;
}

const CodeBox: React.FC<CodeBoxProps> = ({ label, text, val }) => {
  const { state, copy } = useCopy(text);
  return (
    <div className={styles.codeBox}>
      <div className={styles.codeHead}>
        <span className={styles.codeLabel}>{label}</span>
        <button type="button" className="mcp-btn" onClick={copy}>
          {state === 'copied' ? <Check size={12} /> : <Copy size={12} />} {val(state === 'copied' ? MCP_TEXT.connectCopied : MCP_TEXT.connectCopy)}
        </button>
      </div>
      <pre className={styles.code} dir="ltr">{text}</pre>
      {state === 'failed' && <div className={styles.error}>{val(MCP_TEXT.connectCopyFailed)}</div>}
    </div>
  );
};

function claudeChipText(status: ClaudeCodeConnection) {
  if (status.connected) return MCP_TEXT.claudeCodeConnected;
  if (status.cliMissing) return MCP_TEXT.claudeCodeMissing;
  return status.stale ? MCP_TEXT.claudeCodeStale : MCP_TEXT.claudeCodeNotRegistered;
}

function claudeButtonText(busy: boolean, connected: boolean) {
  if (busy) return MCP_TEXT.claudeCodeWorking;
  return connected ? MCP_TEXT.claudeCodeDisconnect : MCP_TEXT.claudeCodeConnect;
}

interface ClaudeCodeCardProps {
  status: ClaudeCodeConnection | null;
  busyId: string | null;
  onToggle: () => void;
  val: Val;
}

// Claude Code is registered at user scope, so one entry serves every folder claude is started from.
const ClaudeCodeCard: React.FC<ClaudeCodeCardProps> = ({ status, busyId, onToggle, val }) => (
  <div className={styles.claudeCard}>
    <span>{val(MCP_TEXT.claudeCodeGlobal)}</span>
    {status && (
      <span className={`${styles.chip} ${status.connected ? styles.chipOn : ''}`}>{val(claudeChipText(status))}</span>
    )}
    <button type="button" className="mcp-btn" disabled={busyId !== null || status?.cliMissing === true} onClick={onToggle}>
      {val(claudeButtonText(busyId === CLAUDE_CODE_ID, status?.connected === true))}
    </button>
  </div>
);

interface GenericActionsProps {
  genericJson: string;
  val: Val;
}

// For clients StudyTs cannot configure itself: inspect the server script, or paste the standard config.
const GenericActions: React.FC<GenericActionsProps> = ({ genericJson, val }) => {
  const standard = useCopy(genericJson);
  const [folderError, setFolderError] = useState<string | null>(null);
  const desktop = window.studytsDesktop;

  const openFolder = async () => {
    const result = await desktop?.mcp.openFolder();
    setFolderError(result?.success === false ? result.error ?? 'Unknown error' : null);
  };

  return (
    <>
      <div className={styles.clientRow}>
        {desktop && (
          <button type="button" className="mcp-btn" onClick={() => void openFolder()}>
            <FolderOpen size={12} /> {val(MCP_TEXT.openMcpFolder)}
          </button>
        )}
        <button type="button" className="mcp-btn" onClick={standard.copy}>
          {standard.state === 'copied' ? <Check size={12} /> : <Copy size={12} />}{' '}
          {val(standard.state === 'copied' ? MCP_TEXT.connectCopied : MCP_TEXT.copyStandardConfig)}
        </button>
      </div>
      {folderError && <div className={styles.error} dir="auto">{folderError}</div>}
      {standard.state === 'failed' && <div className={styles.error}>{val(MCP_TEXT.connectCopyFailed)}</div>}
    </>
  );
};

function confirmText(id: string | null, clients: ConnectClient[], claudeConnected: boolean, val: Val): string {
  if (id === CLAUDE_CODE_ID) return val(claudeConnected ? MCP_TEXT.claudeCodeRemoveConfirm : MCP_TEXT.connectEditsClaudeCode);
  const client = clients.find((c) => c.id === id);
  return client ? val(MCP_TEXT.connectEditsFile).replace('{path}', client.configPath) : '';
}

function outcomeText(outcome: ConnectOutcome, clients: ConnectClient[], val: Val): string {
  if (!outcome.ok) return val(MCP_TEXT.connectFailed).replace('{reason}', outcome.reason);
  if (outcome.removed) return val(MCP_TEXT.claudeCodeRemoved);
  const name = outcome.id === CLAUDE_CODE_ID ? 'Claude Code' : clients.find((c) => c.id === outcome.id)?.name;
  return name ? val(MCP_TEXT.connectDone).replace('{name}', name) : '';
}

export const ConnectAiPanel: React.FC<ConnectAiPanelProps> = ({ val }) => {
  const { info, outcome, busyId, claudeCode, connect, disconnect } = useConnectAi();
  const [confirming, setConfirming] = useState<string | null>(null);

  if (!info) return null;

  const claudeConnected = claudeCode?.connected === true;
  const prompt = confirmText(confirming, info.jsonClients, claudeConnected, val);

  const runConfirmed = async () => {
    if (!confirming) return;
    if (confirming === CLAUDE_CODE_ID && claudeConnected) await disconnect(confirming);
    else await connect(confirming);
    setConfirming(null);
  };

  return (
    <div className={styles.panel}>
      <div className={styles.title}><Plug size={14} /> {val(MCP_TEXT.connectTitle)}</div>
      <div className={styles.desc}>{val(MCP_TEXT.connectDesc)}</div>

      <ClaudeCodeCard status={claudeCode} busyId={busyId} onToggle={() => setConfirming(CLAUDE_CODE_ID)} val={val} />

      <div className={styles.clientRow}>
        {info.jsonClients.map((client) => (
          <button
            key={client.id}
            type="button"
            className="mcp-btn"
            disabled={busyId !== null}
            onClick={() => setConfirming(client.id)}
          >
            {val(MCP_TEXT.connectAddTo).replace('{name}', client.name)}
          </button>
        ))}
      </div>

      {prompt && (
        <div className={styles.confirm} dir="auto">
          <span>{prompt}</span>
          <div className={styles.clientRow}>
            <button type="button" className="mcp-btn" disabled={busyId !== null} onClick={() => void runConfirmed()}>
              {val(MCP_TEXT.connectConfirm)}
            </button>
            <button type="button" className="mcp-btn" onClick={() => setConfirming(null)}>
              {val(MCP_TEXT.connectCancel)}
            </button>
          </div>
        </div>
      )}

      {outcome && (
        <div className={outcome.ok ? styles.success : styles.error} dir="auto">{outcomeText(outcome, info.jsonClients, val)}</div>
      )}

      <GenericActions genericJson={info.genericJson} val={val} />

      <details className={styles.manual}>
        <summary>{val(MCP_TEXT.connectOther)}</summary>
        <div className={styles.desc}>{val(MCP_TEXT.connectOtherDesc)}</div>
        <CodeBox label={val(MCP_TEXT.connectStandardJson)} text={info.genericJson} val={val} />
        <CodeBox label={val(MCP_TEXT.connectCodexToml)} text={info.codexToml} val={val} />
        <CodeBox label={val(MCP_TEXT.connectCodexCommand)} text={info.codexCommand} val={val} />
        <CodeBox label={val(MCP_TEXT.connectClaudeCodeCommand)} text={info.claudeCodeCommand} val={val} />
      </details>
    </div>
  );
};

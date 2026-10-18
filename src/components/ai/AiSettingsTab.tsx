// src/components/ai/AiSettingsTab.tsx
import { useState } from 'react';
import { CheckCircle2, XCircle, ChevronDown } from 'lucide-react';
import type { useAiConnectionSettings, SelectedProvider } from './useAiConnectionSettings';
import { DIRECT_PROVIDERS, type DirectProviderConfig } from '@ai/providers/directProviderCatalog';
import { AI_TEXT } from '../../i18n/dictionary';
import { OmniRouteSettingsPanel } from './OmniRouteSettingsPanel';
import { useChatPreferences } from './useChatPreferences';
import styles from './AiSettingsTab.module.css';

interface AiAdvancedSectionProps {
  val: (input?: unknown) => string;
  activeProviderConfig: DirectProviderConfig;
  customBaseUrl: string;
  setCustomBaseUrl: (v: string) => void;
  sourceEditingEnabled?: boolean;
  setSourceEditingEnabled?: (v: boolean) => void;
  autoScroll: boolean;
  setAutoScroll: (v: boolean) => void;
}

export function AiAdvancedSection({
  val,
  activeProviderConfig,
  customBaseUrl,
  setCustomBaseUrl,
  autoScroll,
  setAutoScroll,
}: AiAdvancedSectionProps) {
  const [open, setOpen] = useState(false);
  return (
    <div className="ai-settings-section">
      <button
        type="button"
        className="ai-settings-section-label ai-advanced-toggle"
        onClick={() => setOpen((v) => !v)}
      >
        Advanced
        <ChevronDown size={14} className={`ai-advanced-chevron ${open ? 'open' : ''}`} />
      </button>
      {open && (
        <>
          {activeProviderConfig.supportsCustomUrl && (
            <div className="ai-setting-group">
              <label>API Base URL</label>
              <input
                type="text"
                value={customBaseUrl}
                onChange={(e) => setCustomBaseUrl(e.target.value)}
                placeholder="http://127.0.0.1:20128/v1"
                className="ai-model-select ai-monospace-input"
                dir="ltr"
              />
            </div>
          )}
          <label className="ai-toggle-label">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
            />
            <span>{val(AI_TEXT.scrollToBottom)} (Auto-scroll chat)</span>
          </label>
        </>
      )}
    </div>
  );
}

interface DirectKeySectionProps {
  val: (input?: unknown) => string;
  activeProviderConfig: DirectProviderConfig;
  isConnected: boolean;
  clearActiveKey: () => void;
  keyInput: string;
  setKeyInput: (v: string) => void;
  testState: 'idle' | 'testing' | 'failed';
  testError: string | null;
  onSaveAndTest: () => void;
  onClearKeyInput: () => void;
}

function DirectKeySection({
  val,
  activeProviderConfig,
  isConnected,
  clearActiveKey,
  keyInput,
  setKeyInput,
  testState,
  testError,
  onSaveAndTest,
  onClearKeyInput,
}: DirectKeySectionProps) {
  return (
    <div className="ai-settings-section">
      <div className="ai-settings-section-label">
        {`${activeProviderConfig.name} ${val(AI_TEXT.keyLabel)}`}
      </div>
      {isConnected ? (
        <div className="ai-settings-connected-row">
          <span className="ai-settings-connected-label">
            <CheckCircle2 size={14} color="var(--accent-green)" />
            {val(AI_TEXT.connected)} · {activeProviderConfig.name}
          </span>
          <button type="button" onClick={clearActiveKey} className="ai-settings-remove-btn">
            {val(AI_TEXT.removeKey)}
          </button>
        </div>
      ) : (
        <>
          <input
            type="password"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder={activeProviderConfig.placeholder}
            className="ai-model-select ai-monospace-input"
            dir="ltr"
          />
          <div className="ai-settings-storage-notice" dir="auto">
            {val(AI_TEXT.keyStorageNotice)}
          </div>
          <div className="ai-button-row">
            <button
              type="button"
              className="ai-test-btn"
              onClick={onSaveAndTest}
              disabled={testState === 'testing' || !keyInput.trim()}
            >
              {testState === 'testing' ? val(AI_TEXT.testing) : val(AI_TEXT.testConnection)}
            </button>
            <button type="button" className="ai-clear-btn" onClick={onClearKeyInput}>
              {val(AI_TEXT.clear)}
            </button>
          </div>
          {testState === 'failed' && (
            <div className="ai-settings-error">
              <XCircle size={14} color="var(--accent-danger)" /> {val(AI_TEXT.connectionFailed)}
              {testError && <span className="ai-settings-error-detail">{testError}</span>}
            </div>
          )}
        </>
      )}
    </div>
  );
}

interface AiSettingsTabProps {
  val: (input?: unknown) => string;
  conn: ReturnType<typeof useAiConnectionSettings>;
  sourceEditingEnabled: boolean;
  setSourceEditingEnabled: (enabled: boolean) => void;
}

export function AiSettingsTab({
  val,
  conn,
  sourceEditingEnabled,
  setSourceEditingEnabled,
}: AiSettingsTabProps) {
  const prefs = useChatPreferences();

  return (
    <div className={styles.root}>
      <div className="settings-section-card">
        <div className="settings-section-title">AI Provider & Routing</div>
        <select
          value={conn.selectedProvider}
          onChange={(e) => conn.setSelectedProvider(e.target.value as SelectedProvider)}
          className="ai-model-select"
        >
          {DIRECT_PROVIDERS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
          <option value="omniroute">OmniRoute</option>
        </select>
      </div>

      {conn.isOmniRoute ? (
        <OmniRouteSettingsPanel val={val} conn={conn} />
      ) : (
        <>
          <DirectKeySection
            val={val}
            activeProviderConfig={conn.activeProviderConfig}
            isConnected={conn.isConnected}
            clearActiveKey={conn.clearActiveKey}
            keyInput={conn.keyInput}
            setKeyInput={conn.setKeyInput}
            testState={conn.testState}
            testError={conn.testError}
            onSaveAndTest={conn.handleSaveAndTest}
            onClearKeyInput={() => conn.setKeyInput('')}
          />

          <div className="settings-section-card">
            <div className="settings-section-title">Model Selection</div>
            <select
              value={conn.directModel}
              onChange={(e) => conn.setDirectModel(e.target.value)}
              className="ai-model-select"
            >
              {conn.activeProviderConfig.models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        </>
      )}

      <AiAdvancedSection
        val={val}
        activeProviderConfig={conn.activeProviderConfig}
        customBaseUrl={conn.customBaseUrl}
        setCustomBaseUrl={conn.setCustomBaseUrl}
        sourceEditingEnabled={sourceEditingEnabled}
        setSourceEditingEnabled={setSourceEditingEnabled}
        autoScroll={prefs.autoScroll}
        setAutoScroll={prefs.setAutoScroll}
      />
    </div>
  );
}

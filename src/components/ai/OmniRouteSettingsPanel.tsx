// src/components/ai/OmniRouteSettingsPanel.tsx
import { CheckCircle2 } from 'lucide-react';
import { AI_TEXT } from '../../i18n/dictionary';
import { OMNIROUTE_MODEL_LABELS, OMNIROUTE_BASE_URL } from '../../ai/chat/aiConnectionDefaults';
import type { useAiConnectionSettings } from './useAiConnectionSettings';
import styles from './OmniRouteSettingsPanel.module.css';

interface OmniRouteSettingsPanelProps {
  val: (input?: unknown) => string;
  conn: ReturnType<typeof useAiConnectionSettings>;
}

export function OmniRouteSettingsPanel({ val, conn }: OmniRouteSettingsPanelProps) {
  return (
    <div className={styles.panel}>
      <div className={styles.section}>
        <div className={styles.label}>{val(AI_TEXT.omniRouteKeyLabel)}</div>
        {conn.isConnected ? (
          <div className={styles.connectedBadge}>
            <span className={styles.connectedStatus}>
              <CheckCircle2 size={14} color="var(--accent-green, #4ade80)" />
              {val(AI_TEXT.connected)} · OmniRoute
            </span>
            <button type="button" onClick={conn.clearActiveKey} className={styles.removeBtn}>
              {val(AI_TEXT.removeKey)}
            </button>
          </div>
        ) : (
          <>
            <input
              type="password"
              value={conn.keyInput}
              onChange={(e) => conn.setKeyInput(e.target.value)}
              placeholder={val(AI_TEXT.omniRouteKeyPlaceholder)}
              className={styles.input}
              dir="ltr"
            />
            <div className={styles.notice} dir="auto">
              {val(AI_TEXT.omniRouteKeyStorageNotice)}
            </div>
            <div className={styles.buttonRow}>
              <button
                type="button"
                className={styles.testBtn}
                onClick={conn.handleSaveAndTest}
                disabled={conn.testState === 'testing' || !conn.keyInput.trim()}
              >
                {conn.testState === 'testing' ? val(AI_TEXT.testing) : val(AI_TEXT.testConnection)}
              </button>
              <button type="button" className={styles.clearBtn} onClick={() => conn.setKeyInput('')}>
                {val(AI_TEXT.clear)}
              </button>
            </div>
          </>
        )}
      </div>

      <div className={styles.section}>
        <div className={styles.label}>{val(AI_TEXT.omniRouteModelLabel)}</div>
        <select
          value={conn.omniRouteModel}
          onChange={(e) => conn.setOmniRouteModel(e.target.value)}
          className="ai-model-select"
        >
          {conn.omniRouteModels.map((m) => (
            <option key={m} value={m}>
              {OMNIROUTE_MODEL_LABELS[m] || m}
            </option>
          ))}
        </select>
        <div className={styles.notice}>Endpoint: {OMNIROUTE_BASE_URL}</div>
      </div>
    </div>
  );
}

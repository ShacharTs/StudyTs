import React, { useState } from 'react';
import { Trash2, RotateCcw, Check } from 'lucide-react';
import { SETTINGS_TEXT } from '../../i18n/dictionary';
import { pruneOldAutoSaves } from '../../hooks/useCanvasLocalBackup';
import { STORAGE_KEYS } from '@core/shared/storageKeys';

interface StorageSettingsTabProps {
  val: (input?: unknown) => string;
}

export const StorageSettingsTab: React.FC<StorageSettingsTabProps> = ({ val }) => {
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleClearAutoSaves = () => {
    pruneOldAutoSaves(0);
    showSuccess(val(SETTINGS_TEXT.clearedSuccess));
  };

  const handleClearAiHistory = () => {
    try {
      localStorage.removeItem(STORAGE_KEYS.aiHistory);
      localStorage.removeItem(STORAGE_KEYS.aiChatMessages);
    } catch { /* localStorage unavailable (private mode / quota) */ }
    showSuccess(val(SETTINGS_TEXT.clearedSuccess));
  };

  const handleResetAll = () => {
    try {
      localStorage.clear();
    } catch { /* localStorage unavailable (private mode / quota) */ }
    showSuccess(val(SETTINGS_TEXT.clearedSuccess));
    setTimeout(() => window.location.reload(), 800);
  };

  return (
    <div className="settings-tab-container">
      {successMsg && (
        <div className="settings-success-banner">
          <Check size={14} /> {successMsg}
        </div>
      )}

      <div className="settings-section-card">
        <div className="settings-section-title">{val(SETTINGS_TEXT.clearAutoSaves)}</div>
        <div className="settings-section-desc">Remove local canvas draft backups from browser storage.</div>
        <button type="button" className="mcp-btn danger settings-action-btn-self" onClick={handleClearAutoSaves}>
          <Trash2 size={13} /> {val(SETTINGS_TEXT.clearAutoSaves)}
        </button>
      </div>

      <div className="settings-section-card">
        <div className="settings-section-title">{val(SETTINGS_TEXT.clearChatHistory)}</div>
        <div className="settings-section-desc">Erase all stored AI chat messages and cached session contexts.</div>
        <button type="button" className="mcp-btn danger settings-action-btn-self" onClick={handleClearAiHistory}>
          <Trash2 size={13} /> {val(SETTINGS_TEXT.clearChatHistory)}
        </button>
      </div>

      <div className="settings-section-card">
        <div className="settings-section-title">{val(SETTINGS_TEXT.resetAll)}</div>
        <div className="settings-section-desc">Clear all stored theme preferences, keys, and cached state (page will reload).</div>
        <button type="button" className="mcp-btn danger settings-action-btn-self" onClick={handleResetAll}>
          <RotateCcw size={13} /> {val(SETTINGS_TEXT.resetAll)}
        </button>
      </div>
    </div>
  );
};

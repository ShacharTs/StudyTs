import React, { useState, useEffect } from 'react';
import { X, Palette, Bot, PlugZap, HardDrive, Terminal, ArrowUpCircle } from 'lucide-react';
import { useTranslation } from '../../i18n';
import { SETTINGS_TEXT, UPDATE_TEXT } from '../../i18n/dictionary';
import { AppearanceSettingsTab } from './AppearanceSettingsTab';
import { StorageSettingsTab } from './StorageSettingsTab';
import { LogsSettingsTab } from './LogsSettingsTab';
import { UpdateSettingsTab } from './UpdateSettingsTab';
import { McpSettingsPanel } from '../mcp/McpSettingsPanel';
import { McpTutorialModal } from '../mcp/McpTutorialModal';
import { useAiConnectionSettings } from '../ai/useAiConnectionSettings';
import { AiSettingsTab } from '../ai/AiSettingsTab';
import styles from './AppSettingsModal.module.css';
import '../../styles/appSettings.css';

export type SettingsTabId = 'appearance' | 'ai' | 'mcp' | 'storage' | 'logs' | 'updates';

const TABS = [
  { id: 'appearance', icon: Palette, label: SETTINGS_TEXT.tabAppearance },
  { id: 'ai', icon: Bot, label: SETTINGS_TEXT.tabAi },
  { id: 'mcp', icon: PlugZap, label: SETTINGS_TEXT.tabMcp },
  { id: 'storage', icon: HardDrive, label: SETTINGS_TEXT.tabStorage },
  { id: 'updates', icon: ArrowUpCircle, label: UPDATE_TEXT.tabTitle },
  { id: 'logs', icon: Terminal, label: SETTINGS_TEXT.tabLogs },
] as const;

interface AppSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: SettingsTabId;
  sourceEditingEnabled: boolean;
  setSourceEditingEnabled: (enabled: boolean) => void;
}

export const AppSettingsModal: React.FC<AppSettingsModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'appearance',
  sourceEditingEnabled,
  setSourceEditingEnabled,
}) => {
  const { val } = useTranslation();
  const [activeTab, setActiveTab] = useState<SettingsTabId>(initialTab);
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);

  const conn = useAiConnectionSettings();

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab, isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="settings-modal-backdrop" onClick={onClose}>
      <div className="settings-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="settings-modal-header">
          <div className="settings-modal-header-title">
            <span className={styles.icon}>⚙️</span> {val(SETTINGS_TEXT.settingsTitle)}
          </div>
          <button type="button" className={`mcp-btn ${styles.closeBtn}`} onClick={onClose}>
            <X size={14} />
          </button>
        </div>

        <div className="settings-modal-layout">
          <div className="settings-sidebar-tabs">
            {TABS.map(({ id, icon: Icon, label }) => (
              <button key={id} type="button" className={`settings-tab-btn ${activeTab === id ? 'active' : ''}`} onClick={() => setActiveTab(id)}>
                <Icon size={15} /> {val(label)}
              </button>
            ))}
          </div>

          <div className="settings-content-area">
            {activeTab === 'appearance' && <AppearanceSettingsTab val={val} />}

            {activeTab === 'ai' && (
              <AiSettingsTab val={val} conn={conn} sourceEditingEnabled={sourceEditingEnabled} setSourceEditingEnabled={setSourceEditingEnabled} />
            )}

            {activeTab === 'mcp' && (
              <McpSettingsPanel val={val} onOpenTutorial={() => setIsTutorialOpen(true)} />
            )}

            {activeTab === 'storage' && <StorageSettingsTab val={val} />}

            {activeTab === 'updates' && <UpdateSettingsTab />}

            {activeTab === 'logs' && <LogsSettingsTab val={val} />}
          </div>
        </div>
      </div>

      <McpTutorialModal
        isOpen={isTutorialOpen}
        onClose={() => setIsTutorialOpen(false)}
        val={val}
      />
    </div>
  );
};

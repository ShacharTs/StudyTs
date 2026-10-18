/**
 * App-shell chrome state: sidebar/week-expansion toggles, modal open flags,
 * and the shared source-editing setting (read/write in one place so
 * AiSettingsModal and AppSettingsModal never drift out of sync).
 */
import { useState, useEffect } from 'react';
import type { SettingsTabId } from '../components/settings/AppSettingsModal';
import { SOURCE_EDITING_STORAGE } from '../ai/chat/aiConnectionDefaults';
import { getStoredItem, setStoredItem } from '../ai/userConfigStorage';
import { STORAGE_KEYS } from '@core/shared/storageKeys';

const SIDEBAR_OPEN_STORAGE = STORAGE_KEYS.sidebarOpen;

export function useAppShellState() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(
    () => getStoredItem(SIDEBAR_OPEN_STORAGE) !== 'false'
  );

  useEffect(() => {
    setStoredItem(SIDEBAR_OPEN_STORAGE, String(isSidebarOpen));
  }, [isSidebarOpen]);
  const [expandedWeeks, setExpandedWeeks] = useState<Record<string, boolean>>({});
  const [isPatchNotesOpen, setIsPatchNotesOpen] = useState(false);
  const [isAiSettingsOpen, setIsAiSettingsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTabId>('appearance');
  const [sourceEditingEnabled, setSourceEditingEnabledState] = useState(
    () => getStoredItem(SOURCE_EDITING_STORAGE) === 'true'
  );

  const setSourceEditingEnabled = (enabled: boolean) => {
    setSourceEditingEnabledState(enabled);
    setStoredItem(SOURCE_EDITING_STORAGE, String(enabled));
  };

  return {
    isSidebarOpen,
    setIsSidebarOpen,
    expandedWeeks,
    setExpandedWeeks,
    isPatchNotesOpen,
    setIsPatchNotesOpen,
    isAiSettingsOpen,
    setIsAiSettingsOpen,
    isSettingsOpen,
    setIsSettingsOpen,
    settingsTab,
    setSettingsTab,
    sourceEditingEnabled,
    setSourceEditingEnabled,
  };
}

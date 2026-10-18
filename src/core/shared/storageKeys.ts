export const STORAGE_KEYS = {
  lang: 'lang',
  accent: 'accent',
  blockStyle: 'blockStyle',
  uiScale: 'uiScale',
  themeMode: 'themeMode',
  sidebarOpen: 'sidebarOpen',
  aiHistory: 'aiHistory',
  aiChatMessages: 'aiChatMessages',
  aiCustomRules: 'aiCustomRules',
  aiDirectProvider: 'aiDirectProvider',
  aiOmnirouteKey: 'aiOmnirouteKey',
  aiCustomBaseUrl: 'aiCustomBaseUrl',
  aiDirectModel: 'aiDirectModel',
  aiOmnirouteModel: 'aiOmnirouteModel',
  aiSourceEditing: 'aiSourceEditing',
  aiPendingTurn: 'aiPendingTurn',
  aiPanelWidth: 'aiPanelWidth',
  aiChatAutoscroll: 'aiChatAutoscroll',
  canvasPalette: 'canvasPalette',
  workspaceMode: 'workspaceMode',
  customModes: 'customModes',
  autoSavePrefix: 'autoSavePrefix:',
  preMigrationBackupPrefix: 'preMigrationBackup:',
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

export function getProviderKeyStorageName(provider: string): string {
  return `ai_${provider}_key`;
}

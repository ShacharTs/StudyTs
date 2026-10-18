// src/ai/chat/aiConnectionDefaults.ts

import { STORAGE_KEYS } from '@core/shared/storageKeys';

export const OMNIROUTE_BASE_URL = '/api/omniroute/v1';
export const OMNIROUTE_KEY_STORAGE = STORAGE_KEYS.aiOmnirouteKey;
export const CUSTOM_BASE_URL_STORAGE = STORAGE_KEYS.aiCustomBaseUrl;
export const DIRECT_MODEL_STORAGE = STORAGE_KEYS.aiDirectModel;
export const OMNIROUTE_MODEL_STORAGE = STORAGE_KEYS.aiOmnirouteModel;
export const SOURCE_EDITING_STORAGE = STORAGE_KEYS.aiSourceEditing;
export const CHAT_AUTOSCROLL_STORAGE = STORAGE_KEYS.aiChatAutoscroll;
// "auto" (bare) is confirmed hung/broken upstream in OmniRoute — never streams real content,
// only empty keepalives forever. "auto/coding" works correctly. Keep it first so it's the default.
export const DEFAULT_OMNIROUTE_MODELS = ['auto/coding', 'claude-3-5-sonnet', 'gpt-4o', 'auto'];

export const OMNIROUTE_MODEL_LABELS: Record<string, string> = {
  'auto': 'Auto — Best model for the task',
  'auto/coding': 'Auto — Best for coding tasks',
  'claude-3-5-sonnet': 'Claude 3.5 Sonnet',
  'gpt-4o': 'GPT-4o',
};

export interface ToolDetail {
  toolName: string;
  rawArgs?: Record<string, unknown>;
  resultData?: unknown;
  error?: string;
  durationMs?: number;
  sqlQuery?: string;
  sceneId?: string;
  topicId?: string;
  opsSummary?: string;
}

export interface DisplayMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  toolCallName?: string;
  toolDetail?: ToolDetail;
  thought?: string;
  isProviderError?: boolean;
}

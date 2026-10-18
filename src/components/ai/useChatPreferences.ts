// src/components/ai/useChatPreferences.ts
import { useState, useCallback } from 'react';
import { CHAT_AUTOSCROLL_STORAGE } from '../../ai/chat/aiConnectionDefaults';
import { getStoredItem, setStoredItem } from '../../ai/userConfigStorage';

export function useChatPreferences() {
  const [autoScroll, setAutoScrollState] = useState<boolean>(() => {
    const stored = getStoredItem(CHAT_AUTOSCROLL_STORAGE);
    return stored === null ? true : stored === 'true';
  });

  const setAutoScroll = useCallback((enabled: boolean) => {
    setAutoScrollState(enabled);
    setStoredItem(CHAT_AUTOSCROLL_STORAGE, String(enabled));
  }, []);

  return { autoScroll, setAutoScroll };
}

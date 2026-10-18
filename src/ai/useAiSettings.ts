import { useState } from 'react';
import type { DirectProvider } from './providers/directProviderCatalog';
import { getStoredItem, setStoredItem, removeStoredItem } from './userConfigStorage';
import { STORAGE_KEYS, getProviderKeyStorageName } from '@core/shared/storageKeys';

export function useAiSettings(initialProvider: DirectProvider = 'gemini') {
  const [provider, setProviderState] = useState<DirectProvider>(() => {
    const saved = (getStoredItem(STORAGE_KEYS.aiDirectProvider) || getStoredItem('complexity_ai_direct_provider')) as DirectProvider | null;
    return saved || initialProvider;
  });

  const [apiKey, setApiKeyState] = useState<string | null>(() => {
    const savedProvider = (getStoredItem(STORAGE_KEYS.aiDirectProvider) as DirectProvider | null) || initialProvider;
    const activeKey = getStoredItem(getProviderKeyStorageName(savedProvider)) || getStoredItem(`complexity_ai_${savedProvider}_key`);
    return activeKey || null;
  });

  const setProvider = (newProvider: DirectProvider) => {
    setStoredItem(STORAGE_KEYS.aiDirectProvider, newProvider);
    setProviderState(newProvider);
    const key = getStoredItem(getProviderKeyStorageName(newProvider)) || getStoredItem(`complexity_ai_${newProvider}_key`);
    setApiKeyState(key || null);
  };

  const setApiKey = (key: string, forProvider?: DirectProvider) => {
    const target = forProvider || provider;
    setStoredItem(getProviderKeyStorageName(target), key);
    setStoredItem(`complexity_ai_${target}_key`, key);
    setApiKeyState(key);
  };

  const clearApiKey = () => {
    removeStoredItem(getProviderKeyStorageName(provider));
    removeStoredItem(`complexity_ai_${provider}_key`);
    setApiKeyState(null);
  };

  return {
    provider,
    setProvider,
    apiKey,
    setApiKey,
    clearApiKey,
    isConnected: apiKey !== null,
    isReady: true,
  };
}

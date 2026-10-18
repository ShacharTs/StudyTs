// src/components/ai/useAiConnectionSettings.ts
/**
 * Provider/key/model connection state for AiSettingsModal: one unified provider
 * picker (OmniRoute is a selectable entry, not a separate mode), API key entry
 * + connection test, and the persisted user AI config.
 */
import { useState, useEffect } from 'react';
import { useAiSettings } from '@ai/useAiSettings';
import { DIRECT_PROVIDERS, DirectProvider } from '@ai/providers/directProviderCatalog';
import { listOmniRouteModels, fetchOmniRouteModels } from '@ai/providers/omniRouteProvider';
import { detectProviderFromKey } from '@core/shared/aiProviders';
import { STORAGE_KEYS, getProviderKeyStorageName } from '@core/shared/storageKeys';
import { getStoredItem, setStoredItem, removeStoredItem } from '@ai/userConfigStorage';
import {
  OMNIROUTE_BASE_URL, OMNIROUTE_KEY_STORAGE, CUSTOM_BASE_URL_STORAGE,
  DIRECT_MODEL_STORAGE, OMNIROUTE_MODEL_STORAGE, DEFAULT_OMNIROUTE_MODELS,
} from '../../ai/chat/aiConnectionDefaults';

/** Sends a one-message chat to the AI proxy; throws with the server's error when the key is rejected. */
async function probeDirectKey(provider: DirectProvider, apiKey: string, model: string): Promise<void> {
  const res = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requestId: crypto.randomUUID(),
      provider,
      apiKey,
      model,
      messages: [{ role: 'user', content: 'Test connection' }],
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Connection failed');
  }
}

export type SelectedProvider = DirectProvider | 'omniroute';

export function useAiConnectionSettings() {
  const {
    provider: directProvider,
    setProvider: setDirectProviderRaw,
    apiKey: directKey,
    setApiKey: setDirectKey,
    clearApiKey: clearDirectKey,
  } = useAiSettings('gemini');

  const [isOmniRoute, setIsOmniRoute] = useState<boolean>(
    () => getStoredItem('complexity_ai_selected_is_omniroute') === 'true'
  );
  const selectedProvider: SelectedProvider = isOmniRoute ? 'omniroute' : directProvider;
  const setSelectedProvider = (p: SelectedProvider) => {
    if (p === 'omniroute') {
      setIsOmniRoute(true);
      setStoredItem('complexity_ai_selected_is_omniroute', 'true');
    } else {
      setIsOmniRoute(false);
      setStoredItem('complexity_ai_selected_is_omniroute', 'false');
      setDirectProviderRaw(p);
    }
  };

  const [omniRouteKey, setOmniRouteKeyState] = useState<string | null>(() => getStoredItem(OMNIROUTE_KEY_STORAGE));
  const [omniRouteModels, setOmniRouteModels] = useState<string[]>(DEFAULT_OMNIROUTE_MODELS);
  const [customBaseUrl, setCustomBaseUrlState] = useState<string>(() => getStoredItem(CUSTOM_BASE_URL_STORAGE) || 'http://127.0.0.1:20128/v1');
  const setCustomBaseUrl = (url: string) => {
    setStoredItem(CUSTOM_BASE_URL_STORAGE, url);
    setCustomBaseUrlState(url);
  };
  const [keyInput, setKeyInput] = useState('');
  const [testState, setTestState] = useState<'idle' | 'testing' | 'failed'>('idle');
  const [testError, setTestError] = useState<string | null>(null);

  const activeProviderConfig = DIRECT_PROVIDERS.find((p) => p.id === directProvider) || DIRECT_PROVIDERS[0];
  const [directModel, setDirectModelState] = useState<string>(
    () => getStoredItem(DIRECT_MODEL_STORAGE) || activeProviderConfig.models[0]?.id || 'gemini-1.5-pro'
  );
  const [omniRouteModel, setOmniRouteModelState] = useState<string>(
    () => getStoredItem(OMNIROUTE_MODEL_STORAGE) || DEFAULT_OMNIROUTE_MODELS[0]
  );

  const setDirectModel = (model: string) => {
    setStoredItem(DIRECT_MODEL_STORAGE, model);
    setDirectModelState(model);
  };
  const setOmniRouteModel = (model: string) => {
    setStoredItem(OMNIROUTE_MODEL_STORAGE, model);
    setOmniRouteModelState(model);
  };

  const [serverConfigured, setServerConfigured] = useState<string[]>([]);

  useEffect(() => {
    fetch('/api/ai/keys')
      .then((r) => (r.ok ? r.json() : { configured: [] }))
      .then((data) => {
        if (Array.isArray(data?.configured)) {
          setServerConfigured(data.configured);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!isOmniRoute) return;
    listOmniRouteModels(OMNIROUTE_BASE_URL, omniRouteKey || undefined).then((models) => {
      if (models.length > 0) setOmniRouteModels(models);
    });
  }, [isOmniRoute, omniRouteKey]);

  useEffect(() => {
    const config = DIRECT_PROVIDERS.find((p) => p.id === directProvider);
    if (config && config.models.length > 0) {
      setDirectModel(config.models[0].id);
    }
  }, [directProvider]);

  const activeKey = isOmniRoute ? omniRouteKey : directKey;
  const isDirectConnected = Boolean(directKey || serverConfigured.includes(directProvider));
  const isOmniRouteConnected = Boolean(omniRouteKey || (omniRouteModels.length > 0 && omniRouteModels !== DEFAULT_OMNIROUTE_MODELS));
  const isConnected = isOmniRoute ? isOmniRouteConnected : isDirectConnected;

  const clearOmniRouteKey = () => {
    setOmniRouteKeyState(null);
    removeStoredItem(OMNIROUTE_KEY_STORAGE);
  };
  const clearActiveKey = () => {
    if (isOmniRoute) {
      clearOmniRouteKey();
    } else {
      clearDirectKey();
      fetch(`/api/ai/keys/${directProvider}`, { method: 'DELETE' }).catch(() => {});
      setServerConfigured((prev) => prev.filter((p) => p !== directProvider));
    }
  };

  const saveOmniRouteKey = async (testKey: string) => {
    const { models, error } = await fetchOmniRouteModels(OMNIROUTE_BASE_URL, testKey);
    if (models.length === 0) throw new Error(error ?? 'No models returned');
    setOmniRouteModels(models);
    setOmniRouteKeyState(testKey);
    setOmniRouteModel(models[0]);
    setStoredItem(OMNIROUTE_KEY_STORAGE, testKey);
  };

  const saveDirectKey = async (testKey: string) => {
    const detectedProvider = detectProviderFromKey(testKey);
    const targetProvider = detectedProvider || (directProvider as DirectProvider);
    const targetConfig = DIRECT_PROVIDERS.find((p) => p.id === targetProvider) || activeProviderConfig;
    await probeDirectKey(targetProvider, testKey, targetConfig.models[0]?.id || directModel);

    setStoredItem(STORAGE_KEYS.aiDirectProvider, targetProvider);
    setStoredItem(getProviderKeyStorageName(targetProvider), testKey);
    setStoredItem(`complexity_ai_${targetProvider}_key`, testKey);
    if (detectedProvider && detectedProvider !== directProvider) {
      setDirectProviderRaw(detectedProvider);
    }
    setDirectKey(testKey, targetProvider);
  };

  const handleSaveAndTest = async () => {
    const testKey = keyInput.trim();
    if (!testKey) return;
    setTestState('testing');
    setTestError(null);

    try {
      await (isOmniRoute ? saveOmniRouteKey(testKey) : saveDirectKey(testKey));
      setKeyInput('');
      setTestState('idle');
    } catch (err) {
      setTestState('failed');
      setTestError(err instanceof Error ? err.message : 'Connection failed');
    }
  };

  return {
    isOmniRoute,
    selectedProvider, setSelectedProvider,
    directProvider: directProvider as DirectProvider,
    activeProviderConfig,
    activeKey, isConnected, clearActiveKey,
    omniRouteModel, setOmniRouteModel, omniRouteModels,
    directModel, setDirectModel,
    customBaseUrl, setCustomBaseUrl,
    keyInput, setKeyInput,
    testState, setTestState,
    testError, setTestError,
    handleSaveAndTest,
  };
}

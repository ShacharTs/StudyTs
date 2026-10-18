// src/components/ai/useAiChatPersistence.ts
/**
 * Chat-session persistence for AiSettingsModal: loads saved displayMessages/
 * conversationHistory on mount, and debounce-saves them back to the server as
 * they change.
 */
import { useState, useEffect, useRef } from 'react';
import { AiMessage } from '@core/shared/aiTypes';
import type { DisplayMessage } from '../../ai/chat/aiConnectionDefaults';

export function useAiChatPersistence(_val?: (input?: unknown) => string) {
  const [displayMessages, setDisplayMessages] = useState<DisplayMessage[]>([]);
  const [conversationHistory, setConversationHistory] = useState<AiMessage[]>([]);

  const chatLoadedRef = useRef(false);
  const [chatLoaded, setChatLoaded] = useState(false);
  useEffect(() => {
    fetch('/api/chat-session')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        // A reload mid-generation: filter out transient __status__* placeholders so stale "Generating…" badges don't linger.
        const messages = (data?.displayMessages ?? []).filter((m: DisplayMessage) => !m.content.startsWith('__status__'));
        if (messages.length) setDisplayMessages(messages);
        // An interrupted turn leaves conversationHistory ending in an unanswered "user"
        // message (the assistant reply is only appended once a response completes) — most
        // providers require strict user/assistant alternation, so the next send would fail
        // silently. Drop the trailing unpaired turn rather than resend a broken history.
        let history: AiMessage[] = data?.conversationHistory ?? [];
        if (history.length && history[history.length - 1].role === 'user') {
          history = history.slice(0, -1);
        }
        if (history.length) setConversationHistory(history);
      })
      .catch(() => {})
      .finally(() => {
        chatLoadedRef.current = true;
        setChatLoaded(true);
      });
  }, []);

  useEffect(() => {
    if (!chatLoadedRef.current) return;
    const timeout = setTimeout(() => {
      // Never persist an in-flight status placeholder — a reload mid-generation must not
      // leave a permanent "Generating…" bubble with no live process behind it.
      const messagesToSave = displayMessages.filter((m) => !m.content.startsWith('__status__'));
      fetch('/api/chat-session', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayMessages: messagesToSave, conversationHistory }),
      }).catch(() => {});
    }, 500);
    return () => clearTimeout(timeout);
  }, [displayMessages, conversationHistory]);

  const clearChat = (setChatError: (v: string | null) => void) => {
    setDisplayMessages([]);
    setConversationHistory([]);
    setChatError(null);
  };

  return {
    chatLoaded,
    displayMessages, setDisplayMessages,
    conversationHistory, setConversationHistory,
    clearChat,
  };
}

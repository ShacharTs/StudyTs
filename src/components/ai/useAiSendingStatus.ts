// src/components/ai/useAiSendingStatus.ts
/** Tracks elapsed seconds while sending, and mirrors isSending into the global AI status indicator. */
import { useState, useEffect, useRef } from 'react';

export function useAiSendingStatus(isSending: boolean, setAiStatus: (status: 'idle' | 'working' | 'done' | 'error') => void) {
  const setStatusRef = useRef(setAiStatus);
  useEffect(() => {
    setStatusRef.current = setAiStatus;
  });
  useEffect(() => {
    if (isSending) {
      setStatusRef.current('working');
    }
  }, [isSending]);

  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  useEffect(() => {
    if (!isSending) {
      setElapsedSeconds(0);
      return;
    }
    const start = Date.now();
    const interval = setInterval(() => setElapsedSeconds(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(interval);
  }, [isSending]);

  return elapsedSeconds;
}

import { useState, useEffect } from 'react';

type AiTaskStatus = 'idle' | 'working' | 'done' | 'error';

let currentStatus: AiTaskStatus = 'idle';
const listeners = new Set<(status: AiTaskStatus) => void>();

export function setAiTaskStatus(status: AiTaskStatus): void {
  currentStatus = status;
  listeners.forEach((fn) => fn(status));
}

export function getAiTaskStatus(): AiTaskStatus {
  return currentStatus;
}

export function useAiTaskStatus(): [AiTaskStatus, (status: AiTaskStatus) => void] {
  const [status, setStatus] = useState<AiTaskStatus>(currentStatus);

  useEffect(() => {
    const listener = (newStatus: AiTaskStatus) => setStatus(newStatus);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return [status, setAiTaskStatus];
}

import { useState } from 'react';

// Replacing a drawing asks inline instead of with a blocking dialog: `ask` runs at once on an empty canvas, else waits for accept.
export function useReplaceConfirm(hasContent: boolean) {
  const [pending, setPending] = useState<(() => void) | null>(null);
  const ask = (run: () => void) => (hasContent ? setPending(() => run) : run());
  const accept = () => {
    pending?.();
    setPending(null);
  };
  return { pending: pending !== null, ask, accept, cancel: () => setPending(null) };
}

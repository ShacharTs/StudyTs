import { useEffect } from 'react';

/** Calls onChange whenever the server reports course data changed outside the UI. EventSource reconnects on its own. */
export function useServerContentChanges(onChange: () => void): void {
  useEffect(() => {
    const source = new EventSource('/api/content-changes');
    source.onmessage = () => onChange();
    return () => source.close();
  }, [onChange]);
}

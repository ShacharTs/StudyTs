import { useEffect, useState } from 'react';
import { VisualStepPlayer } from '@engine/visualStepPlayer';
import type { VisualSpec } from '@core/types/visualSpec';
import { PREVIEW_CHANNEL, isPreviewMessage, type PreviewMessage } from '@components/visualBuilder/previewChannel';
import styles from './VisualPreviewPage.module.css';

export function VisualPreviewPage() {
  const [spec, setSpec] = useState<VisualSpec | null>(null);

  useEffect(() => {
    const channel = new BroadcastChannel(PREVIEW_CHANNEL);
    channel.onmessage = (event: MessageEvent) => {
      if (isPreviewMessage(event.data) && event.data.type === 'spec') setSpec(event.data.spec);
    };
    channel.postMessage({ type: 'ready' } satisfies PreviewMessage);
    const close = () => channel.close();
    window.addEventListener('pagehide', close);
    return () => {
      window.removeEventListener('pagehide', close);
      close();
    };
  }, []);

  return <main className={styles.page}>{spec ? <VisualStepPlayer spec={spec} /> : <p className={styles.waiting}>Waiting for the builder...</p>}</main>;
}

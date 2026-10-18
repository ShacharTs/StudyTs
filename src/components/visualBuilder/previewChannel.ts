import { useCallback, useEffect, useRef } from 'react';
import type { VisualSpec } from '@core/types/visualSpec';

export const PREVIEW_CHANNEL = 'studyts-visual-preview';
export const PREVIEW_PATH = '/step-player/preview';

export type PreviewMessage = { type: 'spec'; spec: VisualSpec } | { type: 'ready' };

export const isPreviewPath = (pathname: string): boolean => pathname.replace(/\/+$/, '') === PREVIEW_PATH;

export const isPreviewMessage = (data: unknown): data is PreviewMessage => {
  const message = data as { type?: unknown; spec?: unknown } | null;
  if (message?.type === 'ready') return true;
  return message?.type === 'spec' && typeof message.spec === 'object' && message.spec !== null;
};

// BroadcastChannel is same-origin by definition; the spec never leaves this origin.
export function usePopOutPreview(spec: VisualSpec): () => void {
  const channelRef = useRef<BroadcastChannel | null>(null);
  const specRef = useRef(spec);
  specRef.current = spec;

  useEffect(() => {
    channelRef.current?.postMessage({ type: 'spec', spec } satisfies PreviewMessage);
  }, [spec]);

  useEffect(() => () => channelRef.current?.close(), []);

  return useCallback(() => {
    if (!channelRef.current) {
      const channel = new BroadcastChannel(PREVIEW_CHANNEL);
      // The new window asks once it has mounted, so it never misses the first spec.
      channel.onmessage = (event: MessageEvent) => {
        if (isPreviewMessage(event.data) && event.data.type === 'ready') channel.postMessage({ type: 'spec', spec: specRef.current } satisfies PreviewMessage);
      };
      channelRef.current = channel;
    }
    window.open(PREVIEW_PATH, 'studyts-visual-preview');
    channelRef.current.postMessage({ type: 'spec', spec: specRef.current } satisfies PreviewMessage);
  }, []);
}

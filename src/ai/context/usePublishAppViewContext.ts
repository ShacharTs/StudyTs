// src/ai/context/usePublishAppViewContext.ts
import { useEffect, useRef } from 'react';
import type { AppViewContext } from '../../core/shared/appViewContext';
import { useAppViewContextStore } from './appViewContextStore';

export function usePublishAppViewContext(context: AppViewContext | null) {
  const leaseSymbolRef = useRef<symbol>(Symbol('app-view-lease'));
  const publish = useAppViewContextStore((s) => s.publish);
  const release = useAppViewContextStore((s) => s.release);

  useEffect(() => {
    const owner = leaseSymbolRef.current;
    if (context) {
      publish(owner, context);
    }
    return () => {
      release(owner);
    };
  }, [context, publish, release]);
}

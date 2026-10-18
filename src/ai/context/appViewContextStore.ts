// src/ai/context/appViewContextStore.ts
import { create } from 'zustand';
import type { AppViewContext } from '../../core/shared/appViewContext';

export interface AppViewContextStore {
  context: AppViewContext | null;
  owner: symbol | null;
  publish(owner: symbol, ctx: AppViewContext): void;
  release(owner: symbol): void;
  clear(): void;
}

export const useAppViewContextStore = create<AppViewContextStore>((set, get) => ({
  context: null,
  owner: null,
  publish: (owner: symbol, ctx: AppViewContext) => {
    set({ owner, context: ctx });
  },
  release: (owner: symbol) => {
    if (get().owner === owner) {
      set({ owner: null, context: null });
    }
  },
  clear: () => set({ owner: null, context: null }),
}));

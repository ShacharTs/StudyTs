// src/ai/context/viewCommands.ts
import { create } from 'zustand';
import { useEffect, useRef } from 'react';

export interface ViewCommands {
  undo?: () => void;
  redo?: () => void;
  previousStep?: () => void;
  replayStep?: () => void;
  goToStep?: (index: number) => void;
}

interface ViewCommandsState {
  commands: ViewCommands;
  owner: symbol | null;
  register(owner: symbol, commands: ViewCommands): void;
  release(owner: symbol): void;
}

export const useViewCommandsStore = create<ViewCommandsState>((set, get) => ({
  commands: {},
  owner: null,
  register: (owner, commands) => set({ owner, commands }),
  release: (owner) => {
    if (get().owner === owner) {
      set({ owner: null, commands: {} });
    }
  },
}));

export function useRegisterViewCommands(commands: ViewCommands) {
  const ownerRef = useRef<symbol>(Symbol('view-commands'));
  const register = useViewCommandsStore((s) => s.register);
  const release = useViewCommandsStore((s) => s.release);

  useEffect(() => {
    const owner = ownerRef.current;
    register(owner, commands);
    return () => {
      release(owner);
    };
  }, [commands, register, release]);
}

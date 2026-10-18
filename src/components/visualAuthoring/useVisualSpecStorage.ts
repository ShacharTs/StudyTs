/** Save/load state for the authoring page: saved keys plus a status line that always shows the last outcome. */
import { useCallback, useEffect, useState } from 'react';
import type { VisualSpec } from '@engine/visualStepPlayer';
import { openSpecForEditing } from '@core/visualBuilder/specOpening';
import { clearPreMigrationBackup } from '@core/visualBuilder/preMigrationBackup';
import { openingNotice } from './specOpeningNotice';
import { listVisualSpecKeys, loadVisualSpec, saveVisualSpec } from './visualSpecStorageApi';

export type VisualSpecStorageStatus =
  | { kind: 'idle' }
  | { kind: 'busy'; message: string }
  | { kind: 'done'; message: string }
  | { kind: 'notice'; message: string }
  | { kind: 'error'; message: string };

/** A spec from a newer app version comes back readOnly: shown, never written back. */
export interface LoadedVisualSpec {
  spec: VisualSpec;
  readOnly: boolean;
}

export interface VisualSpecStorage {
  keys: string[];
  status: VisualSpecStorageStatus;
  /** Resolves true when the save succeeded. */
  save: (key: string, spec: VisualSpec) => Promise<boolean>;
  /** Resolves the spec, or null when loading failed (the reason is in `status`). */
  load: (key: string) => Promise<LoadedVisualSpec | null>;
}

const errorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

export function useVisualSpecStorage(): VisualSpecStorage {
  const [keys, setKeys] = useState<string[]>([]);
  const [status, setStatus] = useState<VisualSpecStorageStatus>({ kind: 'idle' });

  const refreshKeys = useCallback(async () => {
    try {
      setKeys(await listVisualSpecKeys());
    } catch (error) {
      setStatus({ kind: 'error', message: errorMessage(error) });
    }
  }, []);

  useEffect(() => {
    void refreshKeys();
  }, [refreshKeys]);

  const save = useCallback(
    async (key: string, spec: VisualSpec): Promise<boolean> => {
      setStatus({ kind: 'busy', message: `Saving ${key}…` });
      try {
        await saveVisualSpec(key, spec);
        clearPreMigrationBackup(spec.id);
        setStatus({ kind: 'done', message: `Saved ${key}` });
        await refreshKeys();
        return true;
      } catch (error) {
        setStatus({ kind: 'error', message: errorMessage(error) });
        return false;
      }
    },
    [refreshKeys],
  );

  const load = useCallback(async (key: string): Promise<LoadedVisualSpec | null> => {
    setStatus({ kind: 'busy', message: `Loading ${key}…` });
    try {
      const opening = openSpecForEditing(await loadVisualSpec(key));
      const notice = openingNotice(opening);
      if (notice === null) {
        setStatus({ kind: 'done', message: `Loaded ${key}` });
        return { spec: opening.spec, readOnly: false };
      }
      if (opening.readOnly && opening.reason === 'newer') {
        setStatus({ kind: 'notice', message: notice });
        return { spec: opening.spec, readOnly: true };
      }
      setStatus({ kind: 'error', message: notice });
      return null;
    } catch (error) {
      setStatus({ kind: 'error', message: errorMessage(error) });
      return null;
    }
  }, []);

  return { keys, status, save, load };
}

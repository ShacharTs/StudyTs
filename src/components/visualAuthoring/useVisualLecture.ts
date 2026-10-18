/** Load/save state for editing the step player of one course topic, with the same status line as the key storage. */
import { useCallback, useState } from 'react';
import type { VisualSpec } from '@engine/visualStepPlayer';
import { openSpecForEditing } from '@core/visualBuilder/specOpening';
import { clearPreMigrationBackup } from '@core/visualBuilder/preMigrationBackup';
import { openingNotice } from './specOpeningNotice';
import type { VisualLectureTarget } from './visualAuthoringRoute';
import { loadLectureSpec, saveLectureSpec } from './visualLectureApi';
import type { VisualSpecStorageStatus } from './useVisualSpecStorage';

export type VisualLectureLoad = { ok: true; spec: VisualSpec | null; readOnly: boolean } | { ok: false };

export interface VisualLecture {
  status: VisualSpecStorageStatus;
  /** `spec` is null when the topic has no step player yet; `ok: false` means loading failed (see `status`). */
  load: () => Promise<VisualLectureLoad>;
  /** Resolves true when the save succeeded. */
  save: (spec: VisualSpec) => Promise<boolean>;
}

const errorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

export function useVisualLecture(target: VisualLectureTarget | null): VisualLecture {
  const [status, setStatus] = useState<VisualSpecStorageStatus>({ kind: 'idle' });
  // Primitives, so a caller that builds the target object on every render does not retrigger effects.
  const courseId = target?.courseId;
  const weekKey = target?.weekKey;
  const section = target?.section;
  const topicId = target?.topicId;

  const resolveTarget = useCallback((): VisualLectureTarget | null => {
    return courseId && weekKey && section && topicId ? { courseId, weekKey, section, topicId } : null;
  }, [courseId, weekKey, section, topicId]);

  const load = useCallback(async (): Promise<VisualLectureLoad> => {
    const current = resolveTarget();
    if (!current) return { ok: false };
    setStatus({ kind: 'busy', message: `Loading ${current.topicId}…` });
    try {
      const loaded = await loadLectureSpec(current);
      if (!loaded) {
        setStatus({ kind: 'idle' });
        return { ok: true, spec: null, readOnly: false };
      }
      const opening = openSpecForEditing(loaded);
      const notice = openingNotice(opening);
      if (notice === null) {
        setStatus({ kind: 'idle' });
        return { ok: true, spec: opening.spec, readOnly: false };
      }
      if (opening.readOnly && opening.reason === 'newer') {
        setStatus({ kind: 'notice', message: notice });
        return { ok: true, spec: opening.spec, readOnly: true };
      }
      setStatus({ kind: 'error', message: notice });
      return { ok: false };
    } catch (error) {
      setStatus({ kind: 'error', message: errorMessage(error) });
      return { ok: false };
    }
  }, [resolveTarget]);

  const save = useCallback(
    async (spec: VisualSpec): Promise<boolean> => {
      const current = resolveTarget();
      if (!current) return false;
      setStatus({ kind: 'busy', message: `Saving ${current.topicId}…` });
      try {
        await saveLectureSpec(current, spec);
        clearPreMigrationBackup(spec.id);
        setStatus({ kind: 'done', message: `Saved ${current.topicId}` });
        return true;
      } catch (error) {
        setStatus({ kind: 'error', message: errorMessage(error) });
        return false;
      }
    },
    [resolveTarget],
  );

  return { status, load, save };
}

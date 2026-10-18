import { useState } from 'react';
import { DEFAULT_MODE_ID, listModes, modeById } from '@core/visualBuilder/modes/modeRegistry';
import type { WorkspaceMode } from '@core/visualBuilder/modes/workspaceMode';

// The mode only chooses what the galleries and menus show; it never edits the lecture, so a switch keeps the undo history.
// Every opened editor starts in free mode; the choice is not remembered between visits.
export function useWorkspaceMode() {
  const [modeId, setModeId] = useState(DEFAULT_MODE_ID);
  const [showAll, setShowAll] = useState(false);
  const mode = (modeById(modeId) ?? modeById(DEFAULT_MODE_ID)) as WorkspaceMode;
  // A mode with a starter loads it right away (the caller confirms before replacing a drawing).
  const chooseMode = (id: string, onStarter?: (templateRef: string) => void) => {
    if (!modeById(id)) return;
    setModeId(id);
    setShowAll(false);
    const starter = modeById(id)?.starter;
    if (starter) onStarter?.(starter);
  };
  return { mode, modes: listModes(), showAll, setShowAll, chooseMode };
}

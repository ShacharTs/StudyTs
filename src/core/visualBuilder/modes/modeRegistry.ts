import freeMode from './free.mode.json';
import vennMode from './venn.mode.json';
import graphMode from './graph.mode.json';
import tapeMode from './tape.mode.json';
import automataMode from './automata.mode.json';
import networkMode from './network.mode.json';
import diagramsMode from './diagrams.mode.json';
import memoryMode from './memory.mode.json';
import { validateWorkspaceMode } from './validateWorkspaceMode';
import type { WorkspaceMode } from './workspaceMode';

export class ModeRegistryError extends Error {}

// Menu order, as in the approved mock. Modes join this list one phase at a time.
const BUILT_IN_SOURCES: unknown[] = [freeMode, vennMode, graphMode, tapeMode, automataMode, networkMode, memoryMode, diagramsMode];

function loadBuiltIns(): WorkspaceMode[] {
  return BUILT_IN_SOURCES.map((source) => {
    const result = validateWorkspaceMode(source);
    if (result.ok) return result.mode;
    const first = result.errors[0];
    throw new ModeRegistryError(`built-in mode is invalid: ${first.path} ${first.message}`);
  });
}

const BUILT_IN_MODES = loadBuiltIns();

export const DEFAULT_MODE_ID = 'free';

export const listModes = (): readonly WorkspaceMode[] => BUILT_IN_MODES;

export const modeById = (id: string): WorkspaceMode | undefined => BUILT_IN_MODES.find((mode) => mode.id === id);

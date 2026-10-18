import type { LocalizedLabel } from '../diagramPacks/stylePackFormat';

// A mode text is either inline { en, he } or a key into src/i18n/modes.
export type ModeText = LocalizedLabel | { key: string; params?: Record<string, string> };
import type { PresetShape } from '../shapeCatalog';

export const WORKSPACE_MODE_FORMAT = 1;

// Closed on purpose: a config can only name actions that exist in code. Each mode phase appends its own.
export const MODE_ACTION_IDS: readonly string[] = ['rearrange', 'overlaps', 'newTape', 'headLeft', 'headRight', 'scanTape', 'runInput', 'newAutomaton'];

// Closed like the actions: an input tool can only feed a model the code can read and write back.
export const MODE_INPUT_KEYS: readonly string[] = ['tape', 'word'];

// A starter is a template ref (`pack/template`) or an action to run on an empty canvas (`action/<id>`).
export const STARTER_ACTION_PREFIX = 'action/';

export const INSPECTOR_SECTIONS = ['label', 'size', 'style', 'membership', 'stateFlags', 'edgeLabel', 'animate'] as const;
export type InspectorSection = (typeof INSPECTOR_SECTIONS)[number];
export type InspectorConfig = Partial<Record<InspectorSection, boolean>>;

export type ModeToolConfig =
  | { id: 'select' }
  | { id: 'place'; label: ModeText; object: string }
  | { id: 'placePicker'; label: ModeText; objects: string[] }
  | { id: 'connect'; label: ModeText; arrow: 'directed' | 'undirected' | 'both'; labelCycle?: string[]; autoLabel?: boolean }
  | { id: 'stepper'; label: ModeText; action: 'setCount'; min: number; max: number; object: string }
  | { id: 'toggle'; label: ModeText; key: 'directed' | 'weighted' }
  | { id: 'action'; label: ModeText; run: string; primary?: boolean }
  | { id: 'input'; label: ModeText; key: string; pattern?: string }
  | { id: 'autoRun'; label: ModeText }
  | { id: 'algorithm'; label: ModeText; algorithms: string[] }
  | { id: 'chart'; label: ModeText; charts: ModeChart[] };

// One chart a mode offers: its label and note are texts, and its starter is a template ref.
export interface ModeChart {
  id: string;
  label: ModeText;
  note: ModeText;
  starter: string;
}

export type ModeToolId = ModeToolConfig['id'];

export interface WorkspaceMode {
  format: typeof WORKSPACE_MODE_FORMAT;
  id: string;
  label: ModeText | string;
  note?: ModeText;
  icon: string;
  filters: {
    // null shows everything; an empty list shows none.
    categories: string[] | null;
    presets: PresetShape[] | null;
    effects: string[];
  };
  templates: string[];
  starter?: string;
  // Names the starter button when the starter is an action and has no template name.
  starterLabel?: ModeText;
  tools: ModeToolConfig[];
  inspector: InspectorConfig;
  view?: { viewBox?: string; grid?: boolean };
}

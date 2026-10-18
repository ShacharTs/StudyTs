// src/core/validation/blocks/validBlockKinds.ts
import type { CanvasBlock } from '../../types/canvasScene';
export { isLocalizedValue } from '../../../i18n/localizedValue';

export const VALID_BLOCK_KINDS: ReadonlySet<CanvasBlock['kind']> = new Set<CanvasBlock['kind']>([
  'pdf',
  'image',
  'video',
  'youtube',
  'richText',
  'box',
  'graph',
  'automata',
  'stepPlayer',
  'connector',
  'shape',
  'data',
]);

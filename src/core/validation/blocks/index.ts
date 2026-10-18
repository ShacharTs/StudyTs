/**
 * Shared canvas block validation utilities.
 * Used by backend API (server/routes/scenes.ts) and AI tool layer (src/core/ai/tools/canvasGeneratorTools.ts).
 * Implementation split across blockValidatorHelpers.ts (shared primitives),
 * blockKindValidators.ts (per-kind block shape checks), and
 * sceneNodeValidators.ts (scene.nodes graph checks). This file is the barrel.
 */

export { toPlainText } from '../../../i18n/plainText';
export { VALID_BLOCK_KINDS, isLocalizedValue } from './validBlockKinds';
export { validateBlock, validateBlocks } from './validateBlocks';
export { validateSceneNodes } from '../sceneNodes/validateSceneNodes';

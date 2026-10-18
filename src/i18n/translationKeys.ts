// Collection of translatable leaf nodes from the merged dictionary (client and scripts; server uses the snapshot).

import * as dict from './dictionary.js';
import { collectTranslationLeaves, type TranslationLeaf } from '../core/shared/translationLeaves.js';
import './keyRefResolver.js';

export { collectTranslationLeaves };
export type { TranslationLeaf };

export const TRANSLATION_NAMESPACES = {
  AI_TEXT: dict.AI_TEXT,
  ALGORITHM_TEXT: dict.ALGORITHM_TEXT,
  AUTHOR_TEXT: dict.AUTHOR_TEXT,
  BUILDER_TEXT: dict.BUILDER_TEXT,
  BUTTONS_TEXT: dict.BUTTONS_TEXT,
  COMMON_TEXT: dict.COMMON_TEXT,
  HEADERS_TEXT: dict.HEADERS_TEXT,
  HOME_TEXT: dict.HOME_TEXT,
  HUB_TEXT: dict.HUB_TEXT,
  MCP_TEXT: dict.MCP_TEXT,
  PATCH_NOTES_TEXT: dict.PATCH_NOTES_TEXT,
  PLAYER_TEXT: dict.PLAYER_TEXT,
  SETTINGS_TEXT: dict.SETTINGS_TEXT,
  STATUS_TEXT: dict.STATUS_TEXT,
  TOPICS_TEXT: dict.TOPICS_TEXT,
  CANVAS_TEXT: dict.CANVAS_TEXT,
  CANVAS_PATTERNS_TEXT: dict.CANVAS_PATTERNS_TEXT,
  CANVAS_PRESETS_TEXT: dict.CANVAS_PRESETS_TEXT,
  CANVAS_HEADER_TEXT: dict.CANVAS_HEADER_TEXT,
  DUALITY_TEXT: dict.DUALITY_TEXT,
  PIPELINE_TEXT: dict.PIPELINE_TEXT,
  MEDIA_TEXT: dict.MEDIA_TEXT,
  COMPLEXITY_CLASSES: dict.COMPLEXITY_CLASSES,
};

let cachedLeaves: Map<string, TranslationLeaf> | null = null;

export function getTranslationLeaves(): Map<string, TranslationLeaf> {
  if (!cachedLeaves) {
    cachedLeaves = collectTranslationLeaves(TRANSLATION_NAMESPACES);
  }
  return cachedLeaves;
}

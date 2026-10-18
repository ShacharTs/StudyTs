import { mergeLocales } from './mergeLocales';
import type { LocalizedText } from './localizedValue';
import aiCatalogEn from './ai/en.json';
import aiCatalogHe from './ai/he.json';
import appShellEn from './appShell/en.json';
import appShellHe from './appShell/he.json';
import visualAuthoringEn from './visualAuthoring/en.json';
import visualAuthoringHe from './visualAuthoring/he.json';
import modesEn from './modes/en.json';
import modesHe from './modes/he.json';

const aiEn = aiCatalogEn.ai;
const aiHe = aiCatalogHe.ai;
const { author: authorEn, buttons: buttonsEn, common: commonEn, headers: headersEn, home: homeEn, patchNotes: patchNotesEn, player: playerEn, settings: settingsEn, status: statusEn, topics: topicsEn, update: updateEn, mcp: mcpEn, complexityClasses: complexityClassesEn, hub: hubEn } = appShellEn;
const { author: authorHe, buttons: buttonsHe, common: commonHe, headers: headersHe, home: homeHe, patchNotes: patchNotesHe, player: playerHe, settings: settingsHe, status: statusHe, topics: topicsHe, update: updateHe, mcp: mcpHe, complexityClasses: complexityClassesHe, hub: hubHe } = appShellHe;
const { canvas: canvasEn, builderTextB: builderTextBEn, builderTextC: builderTextCEn, insertGallery: insertGalleryEn } = visualAuthoringEn;
const { canvas: canvasHe, builderTextB: builderTextBHe, builderTextC: builderTextCHe, insertGallery: insertGalleryHe } = visualAuthoringHe;
const { algorithmText: algorithmTextEn, memoryText: memoryTextEn, pipelineText: pipelineTextEn } = modesEn;
const { algorithmText: algorithmTextHe, memoryText: memoryTextHe, pipelineText: pipelineTextHe } = modesHe;

// One export per UI area; each pairs the English and Hebrew JSON catalogs in src/i18n/<folder>/.
export const AI_TEXT = mergeLocales(aiEn, aiHe);
// One table for every algorithm run; each domain keeps its own file so the keys of a domain are added in one place.
export const ALGORITHM_TEXT = mergeLocales({ ...algorithmTextEn, ...pipelineTextEn, ...memoryTextEn }, { ...algorithmTextHe, ...pipelineTextHe, ...memoryTextHe });
// The visual builder chrome: three locale files (one per group of components) merged into one table.
export const BUILDER_TEXT = mergeLocales({ ...builderTextBEn, ...builderTextCEn }, { ...builderTextBHe, ...builderTextCHe });
export const AUTHOR_TEXT = mergeLocales(authorEn, authorHe);
export const BUTTONS_TEXT = mergeLocales(buttonsEn, buttonsHe);
export const COMMON_TEXT = mergeLocales(commonEn, commonHe);
export const HEADERS_TEXT = mergeLocales(headersEn, headersHe);
export const HOME_TEXT = mergeLocales(homeEn, homeHe);
export const HUB_TEXT = mergeLocales(hubEn, hubHe);
export const INSERT_GALLERY_TEXT = mergeLocales(insertGalleryEn, insertGalleryHe);
export const MCP_TEXT = mergeLocales(mcpEn, mcpHe);
export const PATCH_NOTES_TEXT = mergeLocales(patchNotesEn, patchNotesHe);
export const PLAYER_TEXT = mergeLocales(playerEn, playerHe);
export const SETTINGS_TEXT = mergeLocales(settingsEn, settingsHe);
export const STATUS_TEXT = mergeLocales(statusEn, statusHe);
export const TOPICS_TEXT = mergeLocales(topicsEn, topicsHe);
export const UPDATE_TEXT = mergeLocales(updateEn, updateHe);

const { patterns, presets, header, duality, pipeline, media, ...canvasText } = mergeLocales(canvasEn, canvasHe);
export const CANVAS_TEXT = canvasText;
export const CANVAS_PATTERNS_TEXT = patterns;
export const CANVAS_PRESETS_TEXT = presets;
export const CANVAS_HEADER_TEXT = header;
export const DUALITY_TEXT = duality;
export const PIPELINE_TEXT = pipeline;
export const MEDIA_TEXT = media;

interface ComplexityClassItem {
  name: LocalizedText;
  description: LocalizedText;
}

export const COMPLEXITY_CLASSES: Record<string, ComplexityClassItem> = mergeLocales(complexityClassesEn, complexityClassesHe);

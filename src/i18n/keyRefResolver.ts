import { setKeyResolver } from './localizedValue';
import { translateAi } from './ai/translateAi';
import { translateVisualAuthoring } from './visualAuthoring/translateVisualAuthoring';
import { translateModes } from './modes/translateModes';
import { translateCanvasBlocks } from './canvasBlocks/translateCanvasBlocks';

type Translate = (key: string, lang: string) => string;

// A stored key is "<folder>.<path>"; the folder picks the catalog that owns the text.
const CATALOGS: Record<string, Translate> = {
  ai: translateAi,
  visualAuthoring: translateVisualAuthoring,
  modes: translateModes,
  canvasBlocks: translateCanvasBlocks,
};

export function resolveKeyRef(key: string, lang: string): string | undefined {
  const dot = key.indexOf('.');
  const translate = CATALOGS[key.slice(0, dot)];
  if (dot < 0 || !translate) return undefined;
  const path = key.slice(dot + 1);
  const text = translate(path, lang);
  return text === path ? undefined : text;
}

setKeyResolver(resolveKeyRef);

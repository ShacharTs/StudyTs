// Applies a validated runtime locale pack to translation leaves and registers the language metadata.

import { LocalePack, PackCoverage } from './localePack.js';
import { TranslationLeaf } from './translationKeys.js';
import { registerLanguage, clearValCache } from './localizedValue.js';

export function applyLocalePack(
  pack: LocalePack,
  leaves: Map<string, TranslationLeaf>
): PackCoverage {
  const { code, nativeName, dir, flag } = pack.meta;
  let translated = 0;
  const missing: string[] = [];

  for (const [key, leaf] of leaves.entries()) {
    const text = pack.strings[key];
    if (text !== undefined && text.trim() !== '') {
      leaf[code] = text;
      translated += 1;
    } else {
      missing.push(key);
    }
  }

  registerLanguage({
    id: code,
    code,
    label: `${nativeName} (${code.toUpperCase()})`,
    nativeName,
    flag: flag || '🌐',
    direction: dir,
  });

  clearValCache();

  return {
    code,
    translated,
    total: leaves.size,
    missing,
  };
}

export function removeLocalePack(
  code: string,
  leaves: Map<string, TranslationLeaf>
): void {
  for (const leaf of leaves.values()) {
    delete leaf[code];
  }
  clearValCache();
}

// src/i18n/plainText.ts
/** A localized value (or plain string) as one plain-text string in the preferred language. */
import { DEFAULT_LANGUAGE, resolveLocalizedText, normalizeUserText } from './localizedValue';

export function toPlainText(val: unknown, preferredLang: string = DEFAULT_LANGUAGE): string {
  return normalizeUserText(val, preferredLang) || resolveLocalizedText(val, preferredLang);
}

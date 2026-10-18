import type { LocalizedText } from './localizedValue';

/** The shape of `T` with every string replaced by `string`: what the Hebrew table must match key for key. */
export type LocaleShape<T> = { [K in keyof T]: T[K] extends string ? string : LocaleShape<T[K]> };

/** `T` with every string replaced by its `{ en, he }` pair. */
export type MergedLocales<T> = { [K in keyof T]: T[K] extends string ? { en: T[K]; he: string } & LocalizedText : MergedLocales<T[K]> };

/**
 * Pairs every string of the English table with the Hebrew string at the same path.
 * A key missing from the Hebrew table is a type error, so a translation cannot be forgotten.
 */
export function mergeLocales<T extends object>(en: T, he: LocaleShape<T>): MergedLocales<T> {
  const merged: Record<string, unknown> = {};
  for (const [key, enValue] of Object.entries(en)) {
    const heValue = (he as Record<string, unknown>)[key];
    merged[key] = typeof enValue === 'string'
      ? { en: enValue, he: heValue }
      : mergeLocales(enValue as object, heValue as LocaleShape<object>);
  }
  return merged as MergedLocales<T>;
}

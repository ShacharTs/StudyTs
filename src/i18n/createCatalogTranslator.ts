import { DEFAULT_LANGUAGE } from '../core/shared/languageDefaults';

export type CatalogNode = string | { readonly [key: string]: CatalogNode };
export type Catalog = { readonly [key: string]: CatalogNode };

function lookup(catalog: Catalog | undefined, key: string): string | undefined {
  let node: CatalogNode | undefined = catalog;
  for (const part of key.split('.')) {
    if (node === undefined || typeof node === 'string') return undefined;
    node = node[part];
  }
  return typeof node === 'string' ? node : undefined;
}

// Unknown keys come back verbatim so a missing string is visible on screen, not blank.
export function createCatalogTranslator(
  catalogs: Record<string, Catalog | undefined>,
  fallbackLang: string = DEFAULT_LANGUAGE,
) {
  return (key: string, lang: string = fallbackLang): string =>
    lookup(catalogs[lang], key) ?? lookup(catalogs[fallbackLang], key) ?? key;
}

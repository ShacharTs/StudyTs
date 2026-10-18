import { createCatalogTranslator } from '../createCatalogTranslator';
import en from './en.json';
import he from './he.json';

export const translateAppShell = createCatalogTranslator({ en, he });

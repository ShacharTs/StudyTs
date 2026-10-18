import { createCatalogTranslator } from '../createCatalogTranslator';
import en from './en.json';
import he from './he.json';

export const translateModes = createCatalogTranslator({ en, he });

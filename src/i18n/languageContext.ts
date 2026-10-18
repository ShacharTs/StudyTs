import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { STORAGE_KEYS } from '@core/shared/storageKeys';
import {
  Language,
  LanguageMetadata,
  LocalizedText,
  TextValue,
  LocalizedValue,
  val,
  resolveLocalized,
  resolveLocalizedText,
  normalizeUserText,
  getOppositeLanguage,
  getLanguageDirection,
  detectDirectionFromText,
  isRtl as checkIsRtl,
  getLanguageLabel,
  getLanguageFlag,
  getRegisteredLanguages,
  getLanguageMetadata,
  registerLanguage,
  isRegisteredLanguage,
  DEFAULT_LANGUAGE,
} from './localizedValue';

/** The `val` function from useTranslation: turns a localized value (or plain string) into text for the current language. */
export type TranslateFn = (input?: unknown) => string;

export type { Language, LanguageMetadata, LocalizedText, TextValue, LocalizedValue };
export {
  val,
  resolveLocalized,
  resolveLocalizedText,
  normalizeUserText,
  getOppositeLanguage,
  getLanguageDirection,
  detectDirectionFromText,
  getLanguageLabel,
  getLanguageFlag,
  getRegisteredLanguages,
  getLanguageMetadata,
  registerLanguage,
  isRegisteredLanguage,
  checkIsRtl as isRtl,
  getOppositeLanguage as switchLanguage,
};

interface TranslationResult {
  val: (input?: unknown) => string;
  resolveLocalized: (val?: unknown) => string;
  lang: Language;
  direction: 'rtl' | 'ltr';
  isRtl: boolean;
}

interface LanguageSettingResult {
  lang: Language;
  languages: LanguageMetadata[];
  currentLanguage: LanguageMetadata;
  setLang: (lang: Language) => void;
  toggleLang: () => void;
  switchLanguage: () => void;
  direction: 'rtl' | 'ltr';
  isRtl: boolean;
}

interface LanguageContextType {
  lang: Language;
  languages: LanguageMetadata[];
  currentLanguage: LanguageMetadata;
  setLang: (lang: Language) => void;
  toggleLang: () => void;
  val: (input?: unknown) => string;
  resolveLocalized: (val?: unknown) => string;
}

interface I18nResult extends TranslationResult, LanguageSettingResult {}

const STORAGE_KEY = STORAGE_KEYS.lang;
const LEGACY_STORAGE_KEY = 'complexity_lang';

function getInitialLanguage(): Language {
  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
      if (saved && isRegisteredLanguage(saved)) return saved;
    }
  } catch { /* localStorage unavailable (private mode / quota) */ }
  return DEFAULT_LANGUAGE;
}

function persistLanguage(lang: Language): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, lang);
    }
  } catch { /* localStorage unavailable (private mode / quota) */ }
}

const defaultLanguageMeta = getLanguageMetadata(DEFAULT_LANGUAGE);

const LanguageContext = createContext<LanguageContextType>({
  lang: DEFAULT_LANGUAGE,
  languages: getRegisteredLanguages(),
  currentLanguage: defaultLanguageMeta,
  setLang: () => {},
  toggleLang: () => {},
  // Outside a provider the saved language still wins, so a bare component never shows the wrong language.
  val: (v) => val(v, getInitialLanguage()),
  resolveLocalized: (v) => val(v, getInitialLanguage()),
});

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Language>(getInitialLanguage);

  const setLang = useCallback((newLang: Language) => {
    setLangState(newLang);
    persistLanguage(newLang);
  }, []);

  const toggleLang = useCallback(() => setLang(getOppositeLanguage(lang)), [lang, setLang]);
  const valFn = useCallback((input?: unknown): string => val(input, lang), [lang]);

  const languages = useMemo(() => getRegisteredLanguages(), []);
  const currentLanguage = useMemo(() => getLanguageMetadata(lang), [lang]);

  useEffect(() => {
    try {
      if (typeof document !== 'undefined') {
        document.documentElement.dir = getLanguageDirection(lang);
        document.documentElement.lang = lang;
      }
    } catch { /* localStorage unavailable (private mode / quota) */ }
  }, [lang]);

  const value = useMemo(
    () => ({
      lang,
      languages,
      currentLanguage,
      setLang,
      toggleLang,
      val: valFn,
      resolveLocalized: valFn,
    }),
    [lang, languages, currentLanguage, setLang, toggleLang, valFn]
  );

  return React.createElement(LanguageContext.Provider, { value }, children);
};

export function useTranslation(): TranslationResult {
  const { val: valResolver, resolveLocalized, lang } = useContext(LanguageContext);
  return useMemo(
    () => ({
      val: valResolver,
      resolveLocalized,
      lang,
      direction: getLanguageDirection(lang),
      isRtl: checkIsRtl(lang),
    }),
    [valResolver, resolveLocalized, lang]
  );
}

export function useLanguageSetting(): LanguageSettingResult {
  const { lang, languages, currentLanguage, setLang, toggleLang } = useContext(LanguageContext);
  return useMemo(
    () => ({
      lang,
      languages,
      currentLanguage,
      setLang,
      toggleLang,
      switchLanguage: toggleLang,
      direction: getLanguageDirection(lang),
      isRtl: checkIsRtl(lang),
    }),
    [lang, languages, currentLanguage, setLang, toggleLang]
  );
}

export function useLanguage(): I18nResult {
  const { val: valResolver, resolveLocalized, lang, languages, currentLanguage, setLang, toggleLang } =
    useContext(LanguageContext);
  return useMemo(
    () => ({
      val: valResolver,
      resolveLocalized,
      lang,
      languages,
      currentLanguage,
      setLang,
      toggleLang,
      switchLanguage: toggleLang,
      direction: getLanguageDirection(lang),
      isRtl: checkIsRtl(lang),
    }),
    [valResolver, resolveLocalized, lang, languages, currentLanguage, setLang, toggleLang]
  );
}

export const useI18n = useLanguage;
export const I18nProvider = LanguageProvider;

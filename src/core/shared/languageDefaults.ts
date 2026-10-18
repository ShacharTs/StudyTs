export const FALLBACK_LANGUAGE = 'en';
export const DEFAULT_LANGUAGE = 'en';
export const BUILT_IN_LANGUAGE_CODES: readonly string[] = ['he', 'en'];

// Same shape the locale packs accept, so a request code and a pack code agree.
export const LANGUAGE_CODE_PATTERN = /^[a-z]{2,3}(-[A-Z]{2})?$/;

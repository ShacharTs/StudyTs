// Limits and constants for drop-in locale packs.

export const LOCALE_PACK_LIMITS = {
  maxBytes: 2 * 1024 * 1024,
  maxStringLength: 4000,
  maxKeys: 20000,
} as const;

export const LOCALE_CODE_PATTERN = /^[a-z]{2,3}(-[A-Z]{2})?$/;

export const RESERVED_LOCALE_CODES: readonly string[] = [
  'en',
  'he',
  '__proto__',
  'constructor',
  'prototype',
  'toString',
  'valueOf',
];

export const DEFAULT_RTL_CODES: readonly string[] = ['ar', 'fa', 'ur', 'yi', 'ps', 'dv'];

export const LOCALE_FETCH_TIMEOUT_MS = 3000;

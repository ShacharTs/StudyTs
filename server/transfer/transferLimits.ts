export const CURRENT_FORMAT_VERSION = 1;
export const ARCHIVE_KINDS = ['course', 'courses', 'backup'] as const;
const MB = 1024 * 1024;
export const TRANSFER_LIMITS = {
  maxCompressedBytes: 50 * MB,
  maxTotalBytes: 200 * MB,
  maxEntryBytes: 25 * MB,
  maxEntries: 5000,
  maxCourses: 100,
  transactionMs: 60_000,
} as const;
/** Same shape as vite-plugins/uploadValidation.ts validateSlug. */
export const COURSE_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;

import { ARCHIVE_KINDS, COURSE_ID_PATTERN, CURRENT_FORMAT_VERSION } from './transferLimits.js';

export type ArchiveKind = (typeof ARCHIVE_KINDS)[number];
export type ArchiveErrorCode =
  | 'corrupt'
  | 'too_large'
  | 'too_many_entries'
  | 'unsafe_path'
  | 'unsupported_version'
  | 'invalid_manifest'
  | 'invalid_course'
  | 'apply_failed';

export class ArchiveError extends Error {
  constructor(
    public code: ArchiveErrorCode,
    message: string,
    public status = 400,
  ) {
    super(message);
    this.name = 'ArchiveError';
  }
}

export interface ArchiveManifest {
  formatVersion: number;
  kind: ArchiveKind;
  createdAt: string;
  appVersion: string;
  courses: { id: string }[];
}

export function buildManifest(
  ids: string[],
  kind: ArchiveKind,
  appVersion: string,
  now = new Date(),
): ArchiveManifest {
  return {
    formatVersion: CURRENT_FORMAT_VERSION,
    kind,
    createdAt: now.toISOString(),
    appVersion,
    courses: ids.map((id) => ({ id })),
  };
}

export function detectKind(ids: string[], isFullBackup: boolean): ArchiveKind {
  if (isFullBackup) return 'backup';
  return ids.length === 1 ? 'course' : 'courses';
}

const bad = (message: string): never => {
  throw new ArchiveError('invalid_manifest', message);
};

export function parseManifest(raw: unknown): ArchiveManifest {
  if (!raw || typeof raw !== 'object') return bad('manifest.json must be an object');
  const m = raw as Record<string, unknown>;
  if (typeof m.formatVersion !== 'number') return bad('manifest.formatVersion must be a number');
  if (m.formatVersion > CURRENT_FORMAT_VERSION) {
    throw new ArchiveError(
      'unsupported_version',
      `Archive format ${m.formatVersion} is newer than supported ${CURRENT_FORMAT_VERSION}; update the app`,
    );
  }
  if (!ARCHIVE_KINDS.includes(m.kind as never)) return bad('manifest.kind is not recognised');
  if (!Array.isArray(m.courses)) return bad('manifest.courses must be an array');
  const ids = (m.courses as { id?: unknown }[]).map((c) => c?.id);
  if (!ids.every((id) => typeof id === 'string' && COURSE_ID_PATTERN.test(id))) {
    return bad('manifest contains an invalid course id');
  }
  return {
    formatVersion: m.formatVersion,
    kind: m.kind as ArchiveKind,
    createdAt: String(m.createdAt ?? ''),
    appVersion: String(m.appVersion ?? ''),
    courses: ids.map((id) => ({ id: id as string })),
  };
}

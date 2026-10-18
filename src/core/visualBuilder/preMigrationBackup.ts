import type { VisualSpec } from '../types/visualSpec';
import { STORAGE_KEYS } from '../shared/storageKeys';

// One slot per spec id: the copy only has to outlive the migration until the user's next successful save.
export function preMigrationBackupKey(specId: string): string {
  return `${STORAGE_KEYS.preMigrationBackupPrefix}${specId}`;
}

export function writePreMigrationBackup(spec: VisualSpec): void {
  localStorage.setItem(preMigrationBackupKey(spec.id), JSON.stringify(spec));
}

export function readPreMigrationBackup(specId: string): VisualSpec | null {
  const raw = localStorage.getItem(preMigrationBackupKey(specId));
  return raw === null ? null : (JSON.parse(raw) as VisualSpec);
}

export function clearPreMigrationBackup(specId: string): void {
  localStorage.removeItem(preMigrationBackupKey(specId));
}

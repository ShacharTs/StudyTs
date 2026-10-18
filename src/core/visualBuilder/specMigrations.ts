import type { VisualSpec } from '../types/visualSpec';

export interface Migration {
  from: number;
  to: number;
  note: string;
  run(spec: VisualSpec): VisualSpec;
}

export const CURRENT_SPEC_VERSION = 1;

export const MIGRATIONS: Migration[] = [];

// Absent specVersion means 1; the field is only written when a migration runs, so untouched specs keep their shape.
// Returns the input reference when no migration applied, so callers can detect a rewrite with `!==`.
export function migrateSpec(spec: VisualSpec, migrations: Migration[] = MIGRATIONS): VisualSpec {
  let migrated = spec;
  for (const migration of migrations) {
    if ((migrated.specVersion ?? 1) === migration.from) {
      migrated = { ...migration.run(migrated), specVersion: migration.to };
    }
  }
  return migrated;
}

import type { VisualSpec } from '../types/visualSpec';
import { CURRENT_SPEC_VERSION, MIGRATIONS, migrateSpec, type Migration } from './specMigrations';
import { writePreMigrationBackup } from './preMigrationBackup';
import { orphansOf } from './builderEdits';

export type SpecOpening =
  | { readOnly: false; spec: VisualSpec }
  | { readOnly: true; reason: 'newer'; spec: VisualSpec }
  | { readOnly: true; reason: 'migrationFailed'; spec: VisualSpec; error: string };

export interface SpecOpeningOptions {
  migrations?: Migration[];
  currentVersion?: number;
}

const errorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

// Runs once per load, not per edit: an edit in the session must never drop an object the user can still see.
function withoutOrphans(spec: VisualSpec): VisualSpec {
  const orphans = new Set(orphansOf(spec));
  if (orphans.size === 0) return spec;
  return { ...spec, elements: spec.elements.filter((el) => !orphans.has(el.id)) };
}

// Migrating and backing up share one try: a backup that cannot be written must also leave the original untouched.
export function openSpecForEditing(raw: VisualSpec, options: SpecOpeningOptions = {}): SpecOpening {
  const { migrations = MIGRATIONS, currentVersion = CURRENT_SPEC_VERSION } = options;
  if ((raw.specVersion ?? 1) > currentVersion) return { readOnly: true, reason: 'newer', spec: raw };
  try {
    const migrated = migrateSpec(raw, migrations);
    if (migrated !== raw) writePreMigrationBackup(raw);
    return { readOnly: false, spec: withoutOrphans(migrated) };
  } catch (error) {
    return { readOnly: true, reason: 'migrationFailed', spec: raw, error: errorMessage(error) };
  }
}

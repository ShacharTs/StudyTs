import { translateVisualAuthoring } from '@i18n';
import type { SpecOpening } from '@core/visualBuilder/specOpening';

// Only the non-editable outcomes need a message; an editable opening returns null.
export function openingNotice(opening: SpecOpening, lang?: string): string | null {
  if (!opening.readOnly) return null;
  if (opening.reason === 'newer') return translateVisualAuthoring('opening.newer', lang);
  return `${translateVisualAuthoring('opening.migrationFailed', lang)}${opening.error}`;
}

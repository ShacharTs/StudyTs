const THEME_TEXT = 'var(--text-1)';

// Literals that earlier object defaults persisted; they mean "theme default", not a user choice.
const LEGACY_DEFAULTS = new Set(['#000000', '#111827', '#2563eb']);

const SHAPE_FILL = 'var(--shape-fill)';
// The solid blue fill that earlier shape defaults persisted.
const LEGACY_SHAPE_FILL = '#dbeafe';

/** Resolves a stored stroke/text color, mapping legacy fixed defaults onto the theme token. */
export function themedColor(value: string | undefined, fallback: string = THEME_TEXT): string {
  if (!value) return fallback;
  return LEGACY_DEFAULTS.has(value.toLowerCase()) ? THEME_TEXT : value;
}

/** Resolves a stored shape fill; the old blue default becomes the theme's translucent fill. */
export function themedFill(value: string | undefined): string {
  if (!value || value.toLowerCase() === LEGACY_SHAPE_FILL) return SHAPE_FILL;
  return value;
}

/** A value an <input type="color"> accepts: valid #rrggbb, else black (tokens and rgba cannot be shown by the picker). */
export function toColorInputValue(value: string | undefined): string {
  return value && /^#[0-9a-f]{6}$/i.test(value) ? value : '#000000';
}

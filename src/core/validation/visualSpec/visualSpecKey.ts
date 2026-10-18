/**
 * The only gate between a request and a file path: saved specs are stored as data/_shared/visual-specs/<key>.json,
 * so a key must be a plain lowercase slug. Shared by the client (disable Save) and the server (reject the request).
 */
export const VISUAL_SPEC_KEY_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;

export function isVisualSpecKey(value: unknown): value is string {
  return typeof value === 'string' && VISUAL_SPEC_KEY_PATTERN.test(value);
}

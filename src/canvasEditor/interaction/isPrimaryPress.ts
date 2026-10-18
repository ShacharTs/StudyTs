/** True for a primary (left) press. Middle presses pan the viewport and right presses open the
 * context menu, so drag handlers must ignore them and let the event bubble. Events without a
 * `button` (synthetic ones in tests) count as primary. */
export function isPrimaryPress(e: { button?: number }): boolean {
  return (e.button ?? 0) === 0;
}

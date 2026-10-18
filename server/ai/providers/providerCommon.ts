/** Tool-call arguments arrive as a JSON string; a malformed one is treated as "no arguments". */
export function parseToolArguments(raw: string | undefined): Record<string, unknown> {
  try {
    return JSON.parse(raw || '{}');
  } catch {
    return {};
  }
}

export function trimTrailingSlashes(url: string): string {
  return url.replace(/\/+$/, '');
}

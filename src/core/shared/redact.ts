const SENSITIVE_KEY_RE = /apikey|api_key|authorization|token|secret|password|bearer/i;

export function redact(value: unknown): unknown {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(redact);
  }
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    result[k] = SENSITIVE_KEY_RE.test(k) ? '[REDACTED]' : redact(v);
  }
  return result;
}

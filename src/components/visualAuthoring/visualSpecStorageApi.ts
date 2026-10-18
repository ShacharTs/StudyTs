/** Thin fetch client for /api/visual-specs. Every failure throws an Error with the status and the server's message. */
import { checkVisualSpec } from '@engine/visualStepPlayer';
import type { VisualSpec } from '@engine/visualStepPlayer';

export async function describeFailure(res: Response, action: string): Promise<string> {
  const body: unknown = await res.json().catch(() => null);
  const record = typeof body === 'object' && body !== null ? (body as { error?: unknown; problems?: unknown }) : {};
  const base = typeof record.error === 'string' ? record.error : res.statusText;
  const problems = Array.isArray(record.problems) && record.problems.length > 0 ? ` — ${record.problems.join('; ')}` : '';
  return `${action} failed (${res.status}): ${base}${problems}`;
}

export async function listVisualSpecKeys(): Promise<string[]> {
  const res = await fetch('/api/visual-specs');
  if (!res.ok) throw new Error(await describeFailure(res, 'Listing saved specs'));
  const body = (await res.json()) as { keys?: unknown };
  return Array.isArray(body.keys) ? body.keys.filter((key): key is string => typeof key === 'string') : [];
}

export async function loadVisualSpec(key: string): Promise<VisualSpec> {
  const res = await fetch(`/api/visual-specs/${encodeURIComponent(key)}`);
  if (!res.ok) throw new Error(await describeFailure(res, 'Loading the spec'));
  const body = (await res.json()) as { spec?: unknown };
  const checked = checkVisualSpec(body.spec);
  // Validation problems are fine here (a hand-edited mirror file can be repaired in the editor); a wrong shape is not.
  if (!checked.spec) throw new Error(`Saved spec is malformed: ${checked.problems.join('; ')}`);
  return checked.spec;
}

export async function saveVisualSpec(key: string, spec: VisualSpec): Promise<void> {
  const res = await fetch(`/api/visual-specs/${encodeURIComponent(key)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ spec }),
  });
  if (!res.ok) throw new Error(await describeFailure(res, 'Saving the spec'));
}

// src/components/courseHub/postCourseAction.ts
/**
 * Dispatches course CRUD actions to the backend content-editor endpoint.
 */
export async function postCourseAction(body: Record<string, unknown>): Promise<void> {
  const response = await fetch('/api/content-editor/course', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const parsed = await response.json();
  if (!response.ok) {
    throw new Error(parsed.error ?? 'Save failed');
  }
}

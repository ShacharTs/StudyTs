/** Load and save the step player of a course topic (Topic.model) through the existing content and content-editor routes. */
import { checkVisualSpec } from '@engine/visualStepPlayer';
import type { VisualSpec } from '@engine/visualStepPlayer';
import type { VisualLectureTarget } from './visualAuthoringRoute';
import { describeFailure } from './visualSpecStorageApi';

const part = encodeURIComponent;

/** The topic's saved spec, or null when it has none yet (a freshly created step-player topic). */
export async function loadLectureSpec(target: VisualLectureTarget): Promise<VisualSpec | null> {
  const res = await fetch(`/api/content/${part(target.courseId)}/${part(target.weekKey)}/${part(target.section)}/${part(target.topicId)}`);
  if (!res.ok) throw new Error(await describeFailure(res, 'Loading the lecture'));
  const body = (await res.json()) as { model?: unknown };
  if (body.model === null || body.model === undefined) return null;
  const checked = checkVisualSpec(body.model);
  // Validation problems are fine (the author can repair them); a wrong shape means this topic holds something else.
  if (!checked.spec) throw new Error(`This topic does not hold a step player: ${checked.problems.join('; ')}`);
  return checked.spec;
}

export async function saveLectureSpec(target: VisualLectureTarget, spec: VisualSpec): Promise<void> {
  const res = await fetch('/api/content-editor/topic-visual', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...target, spec }),
  });
  if (!res.ok) throw new Error(await describeFailure(res, 'Saving the lecture'));
}

import type { VisualSpec } from '@engine/visualStepPlayer';
import type { VisualLectureTarget } from './visualAuthoringRoute';
import { saveLectureSpec } from './visualLectureApi';
import { describeFailure } from './visualSpecStorageApi';

const ALREADY_EXISTS = 'already exists';

async function createStepPlayerTopic(target: VisualLectureTarget, title: string): Promise<void> {
  const { courseId, weekKey, section, topicId } = target;
  const res = await fetch('/api/content-editor/topic', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ courseId, weekKey, section, action: 'create', topic: { id: topicId, title: { en: title }, contentType: 'stepPlayer' } }),
  });
  if (res.ok) return;
  const message = await describeFailure(res, 'Creating the lecture');
  // Publishing again to the same topic is an update, not an error.
  if (!message.includes(ALREADY_EXISTS)) throw new Error(message);
}

export async function publishVisualLecture(target: VisualLectureTarget, title: string, spec: VisualSpec): Promise<void> {
  await createStepPlayerTopic(target, title);
  await saveLectureSpec(target, spec);
}

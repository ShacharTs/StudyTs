import { useEffect, useState } from 'react';
import { fetchRegistry } from '@core/courseDataLoader';
import { isTopicId, resolvePublishChoice, slugifyTopicId } from '@core/visualSpec/publishOptions';
import type { VisualSpec } from '@engine/visualStepPlayer';
import { publishVisualLecture } from './publishVisualLecture';
import type { VisualLectureTarget } from './visualAuthoringRoute';

type Registry = Awaited<ReturnType<typeof fetchRegistry>>;

export type PublishState = { kind: 'idle' } | { kind: 'busy' } | { kind: 'done'; target: VisualLectureTarget } | { kind: 'error'; message: string };

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

function useRegistry(): { registry: Registry; error: string | null } {
  const [registry, setRegistry] = useState<Registry>({});
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    fetchRegistry().then(setRegistry).catch((failure: unknown) => setError(messageOf(failure)));
  }, []);
  return { registry, error };
}

// Course, week and topic id are derived from what the author picked, so a registry that loads later needs no effect.
export function usePublishForm(spec: VisualSpec | null) {
  const { registry, error } = useRegistry();
  const [chosenCourse, setChosenCourse] = useState('');
  const [chosenWeek, setChosenWeek] = useState('');
  const [section, setSection] = useState('lectures');
  const [title, setTitle] = useState('');
  const [typedId, setTypedId] = useState<string | null>(null);
  const [state, setState] = useState<PublishState>({ kind: 'idle' });

  const { courses, courseId, weeks, weekKey } = resolvePublishChoice(registry, chosenCourse, chosenWeek);
  const topicId = typedId ?? slugifyTopicId(title);
  const canPublish = spec !== null && weekKey !== '' && title.trim() !== '' && isTopicId(topicId) && state.kind !== 'busy';

  const publish = async () => {
    if (!spec || !canPublish) return;
    const target = { courseId, weekKey, section, topicId };
    setState({ kind: 'busy' });
    try {
      await publishVisualLecture(target, title.trim(), spec);
      setState({ kind: 'done', target });
    } catch (failure) {
      setState({ kind: 'error', message: messageOf(failure) });
    }
  };

  return {
    courses, weeks, courseId, weekKey, section, title, topicId, state, canPublish, registryError: error, publish,
    setCourse: setChosenCourse, setWeek: setChosenWeek, setSection, setTitle, setTopicId: setTypedId,
  };
}

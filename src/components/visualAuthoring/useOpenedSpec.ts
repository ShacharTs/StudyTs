import { useEffect } from 'react';
import type { VisualSpec } from '@engine/visualStepPlayer';
import type { VisualLectureLoad } from './useVisualLecture';

interface OpenedSpecInput {
  initialKey: string | null;
  lectureTopicId: string | undefined;
  load: (key: string) => Promise<{ spec: VisualSpec; readOnly: boolean } | null | undefined>;
  loadLecture: () => Promise<VisualLectureLoad>;
  replaceWithSpec: (spec: VisualSpec) => void;
  setReadOnly: (readOnly: boolean) => void;
  blankSpec: (id: string) => VisualSpec;
}

// Opens a saved spec (by key) or a course topic's lecture when the page mounts or its target changes.
export function useOpenedSpec({ initialKey, lectureTopicId, load, loadLecture, replaceWithSpec, setReadOnly, blankSpec }: OpenedSpecInput): void {
  useEffect(() => {
    if (!initialKey) return;
    void load(initialKey).then((loaded) => {
      if (!loaded) return;
      replaceWithSpec(loaded.spec);
      setReadOnly(loaded.readOnly);
    });
  }, [initialKey, load, replaceWithSpec, setReadOnly]);

  useEffect(() => {
    if (!lectureTopicId) return;
    void loadLecture().then((result) => {
      if (!result.ok) return;
      // A freshly created step-player topic has no model yet: start from a blank spec named after the topic.
      replaceWithSpec(result.spec ?? blankSpec(lectureTopicId));
      setReadOnly(result.readOnly);
    });
  }, [lectureTopicId, loadLecture, replaceWithSpec, setReadOnly, blankSpec]);
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import { parseVisualSpecJson, serializeVisualSpec } from '@engine/visualStepPlayer';
import type { VisualSpec, VisualSpecParseResult } from '@engine/visualStepPlayer';

export interface VisualSpecDraft {
  text: string;
  setText: (text: string) => void;
  parsed: VisualSpecParseResult;
  previewSpec: VisualSpec;
  replaceWithSpec: (spec: VisualSpec) => void;
}

export function useVisualSpecDraft(initial: VisualSpec): VisualSpecDraft {
  const [text, setText] = useState(() => serializeVisualSpec(initial));
  const [previewSpec, setPreviewSpec] = useState(initial);
  const parsed = useMemo(() => parseVisualSpecJson(text), [text]);

  useEffect(() => {
    if (parsed.spec && parsed.problems.length === 0) {
      setPreviewSpec((prev) => (serializeVisualSpec(prev) === serializeVisualSpec(parsed.spec!) ? prev : parsed.spec!));
    }
  }, [parsed]);

  const replaceWithSpec = useCallback((spec: VisualSpec) => setText(serializeVisualSpec(spec)), []);

  return { text, setText, parsed, previewSpec, replaceWithSpec };
}

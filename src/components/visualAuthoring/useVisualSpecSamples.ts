/**
 * Sample specs come from the course registry (data/<course>/...), not from code: every non-canvas topic is offered,
 * and picking one loads its content and accepts it only if it really is a VisualSpec.
 */
import { useCallback, useEffect, useState } from 'react';
import { fetchRegistry, loadTopicContent } from '@core/courseDataLoader';
import { useTranslation } from '@i18n';
import type { VisualSpec } from '@engine/visualStepPlayer';

export interface VisualSpecSample {
  /** `<courseId>/<topicId>` */
  id: string;
  label: string;
}

export interface VisualSpecSamples {
  samples: VisualSpecSample[];
  error: string | null;
  loadSample: (id: string) => Promise<VisualSpec>;
}

type Registry = Awaited<ReturnType<typeof fetchRegistry>>;

type Course = Registry[string];

function courseSamples(course: Course, resolveLocalized: (value?: unknown) => string): VisualSpecSample[] {
  const topics = Object.values(course.catalog).flatMap((week) => [...week.lectures, ...week.practice]);
  return topics
    .filter((topic) => topic.kind !== 'canvas')
    .map((topic) => ({ id: `${course.id}/${topic.id}`, label: `${course.code} · ${resolveLocalized(topic.title)}` }));
}

function listSamples(registry: Registry, resolveLocalized: (value?: unknown) => string): VisualSpecSample[] {
  return Object.values(registry).flatMap((course) => courseSamples(course, resolveLocalized));
}

export function useVisualSpecSamples(): VisualSpecSamples {
  const { resolveLocalized } = useTranslation();
  const [samples, setSamples] = useState<VisualSpecSample[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchRegistry()
      .then((registry) => {
        if (cancelled) return;
        setSamples(listSamples(registry, resolveLocalized));
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : String(reason));
      });
    return () => {
      cancelled = true;
    };
  }, [resolveLocalized]);

  const loadSample = useCallback(async (id: string): Promise<VisualSpec> => {
    const [courseId, topicId] = id.split('/');
    const content = await loadTopicContent(topicId, courseId);
    if (content.type !== 'visual') throw new Error(`"${id}" is not a visual spec`);
    return content.spec;
  }, []);

  return { samples, error, loadSample };
}

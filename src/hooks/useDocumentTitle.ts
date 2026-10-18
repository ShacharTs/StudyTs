import { useEffect } from 'react';

export const APP_NAME = 'StudyTs';

/** "StudyTs", "StudyTs - Computer Networking", or "StudyTs - Computer Networking - Delay, loss, throughput". Also the default PDF file name. */
export function buildDocumentTitle(...parts: Array<string | undefined>): string {
  return [APP_NAME, ...parts.filter((part): part is string => Boolean(part && part.trim()))].join(' - ');
}

interface TitleSources {
  activeCourseId: string;
  activeTopicId?: string;
  topicContent?: { title?: unknown } | null;
  registry: Record<string, { title?: unknown }>;
  resolveLocalized: (value?: unknown) => string;
}

const asText = (value: unknown, resolve: (v?: unknown) => string): string | undefined =>
  value === undefined ? undefined : typeof value === 'string' ? value : resolve(value);

/** The tab title for the current location: nothing open (course list) is just the app name. */
export function titleFor({ activeCourseId, activeTopicId, topicContent, registry, resolveLocalized }: TitleSources): string {
  const atHub = activeTopicId === 'home';
  const course = atHub ? undefined : asText(registry[activeCourseId]?.title, resolveLocalized);
  const inTopic = !atHub && activeTopicId !== 'course-home' && Boolean(topicContent);
  return buildDocumentTitle(course, inTopic ? asText(topicContent?.title, resolveLocalized) : undefined);
}

/** Keeps the browser tab title (and so the print-to-PDF file name) on the open course and topic. */
export function useDocumentTitle(sources: TitleSources): void {
  const title = titleFor(sources);
  useEffect(() => {
    document.title = title;
  }, [title]);
}

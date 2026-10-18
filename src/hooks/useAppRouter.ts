// App Path Router & Navigation Hook.
// Handles path route parsing, browser history synchronization, and topic content loading.
// Automatically recovers from missing/deleted courses or topics by returning to the lobby or syllabus.

import { useState, useEffect } from 'react';
import { CourseDefinitionAPI, loadTopicContent, TopicContent } from '../core/courseDataLoader';
import { useCourseRegistry } from '../core/courseRegistry/CourseRegistryContext';

type PathRoute = { view: 'hub' | 'course' | 'topic'; courseId: string; topicId: string };
const HUB_PATHS = new Set(['', 'lobby', 'home', 'hub']);

export function getPathRoute(registry: Record<string, CourseDefinitionAPI>): PathRoute {
  const path = window.location.pathname.replace(/^\/+/, '').replace(/\/+$/, '').trim();
  if (HUB_PATHS.has(path)) {
    return { view: 'hub', courseId: '', topicId: 'home' };
  }

  const parts = path.split('/');
  if (parts.length > 1) {
    return { view: 'topic', courseId: parts[0] || '', topicId: parts[1] || 'home' };
  }

  const single = parts[0];
  if (registry[single]) {
    return { view: 'course', courseId: single, topicId: 'course-home' };
  }
  return { view: 'course', courseId: single, topicId: 'course-home' };
}

type Registry = Record<string, CourseDefinitionAPI>;

// Where to go when the active course or topic is missing from the registry; null while valid.
function routeFallback(
  registry: Registry,
  isLoaded: boolean,
  courseId: string,
  topicId: string,
  isLoading: boolean
): { courseId?: string; topicId: string; replaceUrl?: boolean } | null {
  if (!isLoaded || isLoading || topicId === 'home') return null;

  if (!registry[courseId]) {
    return { courseId: '', topicId: 'home', replaceUrl: true };
  }

  if (topicId === 'course-home') return null;

  const catalog = registry[courseId]?.catalog;
  if (!catalog) return { topicId: 'course-home' };

  const exists = Object.values(catalog).some((week) =>
    [...(week.lectures || []), ...(week.practice || [])].some((t) => t.id === topicId)
  );
  return exists ? null : { topicId: 'course-home' };
}

function isNotFoundError(err: { status?: number; message?: string } | null | undefined): boolean {
  const message = err?.message;
  return (
    err?.status === 404 ||
    Boolean(message?.includes('not found')) ||
    Boolean(message?.includes('404')) ||
    Boolean(message?.includes('Failed to fetch dynamically imported module'))
  );
}

function pushPath(path: string): void {
  if (window.location.pathname === path) return;
  window.history.pushState(null, '', path);
}

function replacePath(path: string): void {
  if (window.location.pathname === path) return;
  window.history.replaceState(null, '', path);
}

export function useAppRouter() {
  const { registry, isLoaded } = useCourseRegistry();
  const initialRoute = getPathRoute(registry);
  const [activeCourseId, setActiveCourseId] = useState<string>(initialRoute.courseId);
  const [activeTopicId, setActiveTopicId] = useState<string>(initialRoute.topicId);
  const [topicContent, setTopicContent] = useState<TopicContent | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const handlePopState = () => {
      const route = getPathRoute(registry);
      setActiveCourseId(route.courseId);
      setActiveTopicId(route.topicId);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [registry]);

  // Synchronize router state with registry updates (fallback to lobby if course missing)
  useEffect(() => {
    const fix = routeFallback(registry, isLoaded, activeCourseId, activeTopicId, isLoading);
    if (!fix) return;
    if (fix.courseId !== undefined) setActiveCourseId(fix.courseId);
    setActiveTopicId(fix.topicId);
    if (fix.replaceUrl) replacePath('/lobby');
  }, [registry, isLoaded, activeCourseId, activeTopicId, isLoading]);

  useEffect(() => {
    let cancelled = false;

    if (activeTopicId === 'home') {
      pushPath('/lobby');
      setTopicContent(null);
      setIsLoading(false);
      setHasError(false);
      return;
    }

    if (activeTopicId === 'course-home') {
      if (activeCourseId) pushPath(`/${activeCourseId}`);
      setTopicContent(null);
      setIsLoading(false);
      setHasError(false);
      return;
    }

    pushPath(`/${activeCourseId}/${activeTopicId}`);
    setIsLoading(true);
    setHasError(false);

    loadTopicContent(activeTopicId, activeCourseId)
      .then((data) => {
        if (cancelled) return;
        setTopicContent(data);
        setIsLoading(false);
        setHasError(false);
      })
      .catch((err) => {
        if (cancelled) return;
        if (isNotFoundError(err)) {
          if (registry[activeCourseId]) {
            setActiveTopicId('course-home');
          } else {
            setActiveCourseId('');
            setActiveTopicId('home');
            replacePath('/lobby');
          }
        } else {
          setHasError(true);
        }
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeTopicId, activeCourseId, retryCount, registry]);

  const retryLoad = () => setRetryCount((n) => n + 1);

  return {
    activeCourseId,
    setActiveCourseId,
    activeTopicId,
    setActiveTopicId,
    topicContent,
    isLoading,
    hasError,
    retryLoad,
  };
}

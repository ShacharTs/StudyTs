// Live-refreshable course registry context + hook.
// The provider lives in CourseRegistryProvider.tsx.

import { createContext, useContext } from 'react';
import type { CourseDefinitionAPI } from '../courseDataLoader';

export interface CourseRegistryContextValue {
  registry: Record<string, CourseDefinitionAPI>;
  isLoaded: boolean;
  refreshRegistry: () => Promise<void>;
}
export const CourseRegistryContext = createContext<CourseRegistryContextValue | null>(null);

export function useCourseRegistry(): CourseRegistryContextValue {
  const ctx = useContext(CourseRegistryContext);
  if (!ctx) throw new Error('useCourseRegistry must be used within a CourseRegistryProvider');
  return ctx;
}

// Live-refreshable course registry provider. Fetches from backend API (/api/registry).

import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { fetchRegistry, clearRegistryCache, CourseDefinitionAPI } from '../courseDataLoader';
import { log } from '../logger';
import { CourseRegistryContext } from './CourseRegistryContext';

export const CourseRegistryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [registry, setRegistry] = useState<Record<string, CourseDefinitionAPI>>({});
  const [isLoaded, setIsLoaded] = useState(false);

  // Initial fetch on mount
  useEffect(() => {
    fetchRegistry()
      .then(setRegistry)
      .catch((err) => {
        log.error('Course registry initial fetch failed', { error: String(err) });
      })
      .finally(() => {
        setIsLoaded(true);
      });
  }, []);

  const refreshRegistry = useCallback(async () => {
    try {
      clearRegistryCache();
      const fresh = await fetchRegistry();
      setRegistry(fresh);
    } catch (err) {
      log.warn('Course registry live refresh failed', { error: String(err) });
    }
  }, []);

  const value = useMemo(() => ({ registry, isLoaded, refreshRegistry }), [registry, isLoaded, refreshRegistry]);

  return <CourseRegistryContext.Provider value={value}>{children}</CourseRegistryContext.Provider>;
};
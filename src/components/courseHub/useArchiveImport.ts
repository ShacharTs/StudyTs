import { useState, useCallback } from 'react';

export type ArchiveImportConflictPolicy = 'skip' | 'replace' | 'duplicate';

export interface PreviewCourse {
  sourceId: string;
  title: string;
  conflict: boolean;
  topicCount: number;
}

export interface ArchivePreview {
  kind: 'course' | 'courses' | 'backup';
  formatVersion: number;
  courses: PreviewCourse[];
}

export type ImportState =
  | { status: 'idle' }
  | { status: 'previewing' }
  | {
      status: 'ready';
      file: File;
      preview: ArchivePreview;
      policies: Record<string, ArchiveImportConflictPolicy>;
    }
  | { status: 'importing' }
  | { status: 'done'; result: { imported: string[]; skipped: string[] } }
  | { status: 'error'; code: string; message: string };

export function useArchiveImport(onImported?: () => void) {
  const [state, setState] = useState<ImportState>({ status: 'idle' });

  const choose = useCallback(async (file: File) => {
    setState({ status: 'previewing' });
    try {
      const buffer = await file.arrayBuffer();
      const res = await fetch('/api/transfer/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/zip' },
        body: buffer,
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        setState({
          status: 'error',
          code: errJson.code || 'import_failed',
          message: errJson.error || 'Failed to inspect archive',
        });
        return;
      }

      const preview: ArchivePreview = await res.json();
      const initialPolicies: Record<string, ArchiveImportConflictPolicy> = {};
      for (const course of preview.courses) {
        initialPolicies[course.sourceId] = course.conflict ? 'replace' : 'skip';
      }

      setState({
        status: 'ready',
        file,
        preview,
        policies: initialPolicies,
      });
    } catch (err) {
      setState({
        status: 'error',
        code: 'preview_error',
        message: String((err as Error)?.message || err),
      });
    }
  }, []);

  const setPolicy = useCallback((sourceId: string, policy: ArchiveImportConflictPolicy) => {
    setState((prev) => {
      if (prev.status !== 'ready') return prev;
      return {
        ...prev,
        policies: {
          ...prev.policies,
          [sourceId]: policy,
        },
      };
    });
  }, []);

  const confirm = useCallback(async () => {
    if (state.status !== 'ready') return;
    const { file, policies } = state;
    setState({ status: 'importing' });

    try {
      const buffer = await file.arrayBuffer();
      const res = await fetch('/api/transfer/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/zip',
          'X-Conflict-Policy': JSON.stringify(policies),
        },
        body: buffer,
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        setState({
          status: 'error',
          code: errJson.code || 'import_failed',
          message: errJson.error || 'Failed to import archive',
        });
        return;
      }

      const result = await res.json();
      setState({ status: 'done', result });
      onImported?.();
    } catch (err) {
      setState({
        status: 'error',
        code: 'import_error',
        message: String((err as Error)?.message || err),
      });
    }
  }, [state, onImported]);

  const reset = useCallback(() => {
    setState({ status: 'idle' });
  }, []);

  return {
    state,
    choose,
    setPolicy,
    confirm,
    reset,
  };
}

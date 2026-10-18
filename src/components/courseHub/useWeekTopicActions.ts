// src/components/courseHub/useWeekTopicActions.ts
import { useState } from 'react';
import type { TopicCatalogEntry } from '../../core/courseDataLoader';
import { buildVisualAuthoringUrl } from '../visualAuthoring/visualAuthoringRoute';
import { uploadTopicFile } from './topicFileUpload';

async function postAction(url: string, body: Record<string, unknown>): Promise<{ updatedId: string }> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const parsed = await response.json();
  if (!response.ok) {
    const error = new Error(parsed.error ?? 'Save failed') as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return parsed;
}

export type EditingTopic = {
  weekKey: string;
  section: 'lectures' | 'practice';
  topic: TopicCatalogEntry | null;
};

/** The authoring page is its own entry point (not a course route), so reaching it is a full navigation. */
const openAuthoringPage = (url: string): void => window.location.assign(url);

export function useWeekTopicActions(
  courseId: string,
  refreshRegistry: () => Promise<void> | void,
  onSelectTopic?: (topicId: string) => void,
  openAuthoring: (url: string) => void = openAuthoringPage
) {
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmingDeleteWeek, setConfirmingDeleteWeek] = useState<string | null>(null);
  const [pendingCascadeWeek, setPendingCascadeWeek] = useState<string | null>(null);
  const [confirmingDeleteTopicId, setConfirmingDeleteTopicId] = useState<string | null>(null);

  const handleSaveWeek = (weekKey: string | null, fields: Record<string, unknown>): Promise<void> => {
    const body = weekKey
      ? { courseId, action: 'update', weekKey, title: fields.title }
      : { courseId, action: 'create', weekKey: fields.weekKey, title: fields.title };
    return postAction('/api/content-editor/week', body).then(() => refreshRegistry());
  };

  const handleDeleteWeekClick = (e: React.MouseEvent, weekKey: string) => {
    e.stopPropagation();
    if (confirmingDeleteWeek !== weekKey) {
      setConfirmingDeleteWeek(weekKey);
      window.setTimeout(() => setConfirmingDeleteWeek((prev) => (prev === weekKey ? null : prev)), 3000);
      return;
    }
    setConfirmingDeleteWeek(null);
    postAction('/api/content-editor/week', { courseId, action: 'delete', weekKey })
      .then(() => refreshRegistry())
      .catch((err: Error & { status?: number }) => {
        if (err.status === 409) {
          setPendingCascadeWeek(weekKey);
          return;
        }
        setActionError(err.message);
      });
  };

  const handleCascadeConfirm = (weekKey: string) => {
    setPendingCascadeWeek(null);
    postAction('/api/content-editor/week', { courseId, action: 'delete', weekKey, cascade: true })
      .then(() => refreshRegistry())
      .catch((err: Error) => setActionError(err.message));
  };

  // A new file topic is created first, then the picked document is stored and attached to it.
  const attachPendingFile = async (file: File, topicId: string, weekKey: string, section: 'lectures' | 'practice') => {
    const record = await uploadTopicFile(file, courseId, topicId);
    await postAction('/api/content-editor/topic', { courseId, weekKey, section, action: 'update', topic: { id: topicId, attachments: [record] } });
  };

  const handleSaveTopic = (
    weekKey: string,
    section: 'lectures' | 'practice',
    existing: TopicCatalogEntry | null,
    fields: Record<string, unknown>
  ): Promise<void> => {
    const body = existing
      ? {
          courseId,
          weekKey,
          section,
          action: 'update',
          topic: { id: existing.id, title: fields.title, description: fields.description, ...(fields.attachments !== undefined && { attachments: fields.attachments }) },
        }
      : {
          courseId,
          weekKey,
          section,
          action: 'create',
          topic: {
            id: fields.id,
            title: fields.title,
            description: fields.description,
            // 'canvas' (default) vs 'stepPlayer' — chosen in EntityEditor.tsx's
            // Content Type picker, read server-side in topicCrud.ts's createTopic
            // to decide whether the new topic gets a real empty CanvasScene or
            // starts scene:null (falls through to the legacy steps view).
            contentType: fields.contentType ?? 'canvas',
          },
        };
    return postAction('/api/content-editor/topic', body).then(async (res) => {
      if (!existing && fields.pendingFile instanceof File) {
        // The topic exists before its file does; show the card now so a failed upload cannot hide it.
        await refreshRegistry();
        await attachPendingFile(fields.pendingFile, res.updatedId, weekKey, section);
      }
      if (!existing && fields.contentType === 'stepPlayer') {
        // A new step player has nothing to show yet: go straight to building it.
        openAuthoring(buildVisualAuthoringUrl({ courseId, weekKey, section, topicId: res.updatedId }));
        return undefined;
      }
      if (!existing) {
        if (onSelectTopic) {
          onSelectTopic(res.updatedId);
        } else {
          window.history.pushState(null, '', `/${courseId}/${res.updatedId}`);
        }
      }
      return refreshRegistry();
    });
  };

  const handleDeleteTopicClick = (e: React.MouseEvent, weekKey: string, section: 'lectures' | 'practice', topicId: string) => {
    e.stopPropagation();
    if (confirmingDeleteTopicId !== topicId) {
      setConfirmingDeleteTopicId(topicId);
      window.setTimeout(() => setConfirmingDeleteTopicId((prev) => (prev === topicId ? null : prev)), 3000);
      return;
    }
    setConfirmingDeleteTopicId(null);
    postAction('/api/content-editor/topic', { courseId, weekKey, section, action: 'delete', topic: { id: topicId } })
      .then(() => refreshRegistry())
      .catch((err: Error) => setActionError(err.message));
  };

  const handleMoveTopic = (weekKey: string, section: 'lectures' | 'practice', topicId: string, toIndex: number): void => {
    postAction('/api/content-editor/topic', { courseId, weekKey, section, action: 'move', topic: { id: topicId, toIndex } })
      .then(() => refreshRegistry())
      .catch((err: Error) => setActionError(err.message));
  };

  return {
    handleMoveTopic,
    actionError,
    confirmingDeleteWeek,
    pendingCascadeWeek,
    setPendingCascadeWeek,
    confirmingDeleteTopicId,
    handleSaveWeek,
    handleDeleteWeekClick,
    handleCascadeConfirm,
    handleSaveTopic,
    handleDeleteTopicClick,
  };
}

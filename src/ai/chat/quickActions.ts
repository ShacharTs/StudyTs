import { AI_TEXT } from '../../i18n/dictionary';
import type { LocalizedText } from '../../i18n/localizedValue';

/** Where the user is in the app: the course list, a course's page, or an open topic. */
export type ChatContext = 'hub' | 'course' | 'topic';

export interface QuickAction {
  id: string;
  label: LocalizedText;
  prompt: LocalizedText;
}

const QUICK_ACTIONS_BY_CONTEXT: Record<ChatContext, QuickAction[]> = {
  hub: [{ id: 'create-course', label: AI_TEXT.quickCreateCourse, prompt: AI_TEXT.quickCreateCoursePrompt }],
  course: [{ id: 'create-topic', label: AI_TEXT.quickCreateTopic, prompt: AI_TEXT.quickCreateTopicPrompt }],
  topic: [
    { id: 'create-canvas', label: AI_TEXT.quickCreateCanvas, prompt: AI_TEXT.quickCreateCanvasPrompt },
    { id: 'fix-page', label: AI_TEXT.quickFixPage, prompt: AI_TEXT.quickFixPagePrompt },
    { id: 'explain', label: AI_TEXT.quickExplain, prompt: AI_TEXT.quickExplainPrompt },
  ],
};

export const quickActionsFor = (context: ChatContext): QuickAction[] => QUICK_ACTIONS_BY_CONTEXT[context];

/** 'home' is the course list and 'course-home' a course's page; any other id with loaded content is a topic. */
export function chatContextOf(activeTopicId: string | undefined, hasTopicContent: boolean): ChatContext {
  if (activeTopicId === 'home') return 'hub';
  if (!activeTopicId || activeTopicId === 'course-home' || !hasTopicContent) return 'course';
  return 'topic';
}

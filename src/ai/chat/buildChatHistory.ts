// src/ai/chat/buildChatHistory.ts
/** The messages for one chat turn: sealed system prompt (with app state and rules), history, then the user prompt. */
import type { AiMessage } from '@core/shared/aiTypes';
import { serializeAppContext } from '@ai/context/contextSerializer';
import { describeSelection } from '@ai/context/selectionSummary';
import { buildSealedSystemPrompt } from '@ai/systemPrompt/immutableRules';
import { useAppViewContextStore } from '../context/appViewContextStore';
import type { AppViewContext } from '@core/shared/appViewContext';
import type { TopicContent, CourseDefinitionAPI } from '../../core/courseDataLoader';

export interface AttachedFile {
  name: string;
  content: string;
}

/** The user's prompt, followed by the attached files (if any) inline. */
export function userContent(prompt: string, attachments?: AttachedFile[] | AttachedFile | null): string {
  if (!attachments) return prompt;
  const list = Array.isArray(attachments) ? attachments : [attachments];
  if (list.length === 0) return prompt;
  const blocks = list.map((f) => `\n\n[Attached file: ${f.name}]\n${f.content}`).join('');
  return prompt + blocks;
}

export interface ChatHistoryInput {
  prompt: string;
  attachments?: AttachedFile[];
  attachedFile?: AttachedFile | null;
  conversationHistory: AiMessage[];
  activeCourseId?: string;
  activeTopicId?: string;
  topicContent?: TopicContent | null;
  registry: Record<string, CourseDefinitionAPI>;
  viewContext?: AppViewContext | null;
}

/** The messages for this turn: sealed system prompt (with app state and rules), history, then the user prompt. */
export async function buildChatHistory(input: ChatHistoryInput): Promise<AiMessage[]> {
  const { prompt, attachments, attachedFile, conversationHistory, activeCourseId, activeTopicId, topicContent, registry } = input;
  const files = attachments ?? (attachedFile ? [attachedFile] : []);
  const serialized = serializeAppContext({ activeCourseId, activeTopicId, topicContent, registry, selection: describeSelection() });
  const viewContext = input.viewContext ?? useAppViewContextStore.getState().context;
  const systemMessage = buildSealedSystemPrompt({
    activeCourseId,
    activeTopicId,
    serializedState: serialized,
    viewContext,
  });
  return [
    { role: 'system', content: systemMessage },
    ...conversationHistory,
    { role: 'user', content: userContent(prompt, files) },
  ];
}

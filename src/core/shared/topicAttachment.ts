// src/core/shared/topicAttachment.ts
/** Lecture documents attached to a topic. Shared by the server (the authority) and the course editor (UX). */

// The formats a file topic accepts. The server checks the same list before storing anything.
export const TOPIC_ATTACHMENT_TYPES = ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'csv', 'txt', 'md'] as const;
export type TopicAttachmentType = (typeof TOPIC_ATTACHMENT_TYPES)[number];

export interface TopicAttachment {
  id: string;
  name: string;
  type: TopicAttachmentType;
  filePath: string;
  uploadedAt: string;
  sizeBytes: number;
}

/** The attachment type for a file extension, or null when the format is not accepted. */
export function attachmentTypeOf(extension: string): TopicAttachmentType | null {
  const lower = extension.toLowerCase();
  return (TOPIC_ATTACHMENT_TYPES as readonly string[]).includes(lower) ? (lower as TopicAttachmentType) : null;
}

function isAttachmentRecord(value: unknown): value is TopicAttachment {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === 'string' &&
    typeof item.name === 'string' &&
    (TOPIC_ATTACHMENT_TYPES as readonly string[]).includes(item.type as string) &&
    typeof item.filePath === 'string' &&
    typeof item.uploadedAt === 'string' &&
    typeof item.sizeBytes === 'number'
  );
}

export function isTopicAttachmentList(value: unknown): value is TopicAttachment[] {
  return Array.isArray(value) && value.every(isAttachmentRecord);
}

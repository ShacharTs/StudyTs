// src/components/courseHub/topicFileUpload.ts
/** Stores a document in the project's data folder and returns the attachment record that points at it. */
import { API_PATHS } from '@core/shared/apiPaths';
import { attachmentTypeOf, type TopicAttachment } from '@core/shared/topicAttachment';

export function extensionOf(name: string): string {
  return name.includes('.') ? (name.split('.').pop() ?? '') : '';
}

export async function uploadTopicFile(file: File, courseId: string, topicId: string): Promise<TopicAttachment> {
  const type = attachmentTypeOf(extensionOf(file.name));
  if (!type) throw new Error(`Unsupported file type: ${file.name}`);
  const response = await fetch(`${API_PATHS.canvasEditor}/upload`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'x-upload-course': courseId,
      'x-upload-topic': topicId,
      // Headers must be Latin-1, so a Hebrew or accented name is percent-encoded; the server only reads its extension.
      'x-upload-filename': encodeURIComponent(file.name),
    },
    body: file,
  });
  const body = (await response.json()) as { path?: string; error?: string };
  if (!response.ok || !body.path) throw new Error(body.error ?? `Upload failed (${response.status})`);
  return {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    name: file.name,
    type,
    filePath: body.path,
    uploadedAt: new Date().toISOString(),
    sizeBytes: file.size,
  };
}

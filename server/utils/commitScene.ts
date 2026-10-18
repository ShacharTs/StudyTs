import type { PrismaClient, Prisma } from '@prisma/client';
import { syncTopicToFiles } from './fileSync.js';
import { dropEditorDoc } from './dropEditorDoc.js';

export type SceneWriter = 'ai-ops' | 'editor' | 'undo' | 'import' | 'seed';

/** The one path every scene write takes: DB first, then the editor cache and the data/ file stay consistent with it. */
export async function commitScene(
  prisma: PrismaClient,
  topic: { id: number; topicId: string },
  scene: Record<string, unknown>,
  writer: SceneWriter,
): Promise<void> {
  await prisma.topic.update({ where: { id: topic.id }, data: { scene: scene as Prisma.InputJsonObject } });
  if (writer !== 'editor') await dropEditorDoc(prisma, topic.topicId);
  if (writer !== 'seed') await syncTopicToFiles(prisma, topic.id);
}

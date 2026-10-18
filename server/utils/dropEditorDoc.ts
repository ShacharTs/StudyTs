import type { PrismaClient } from '@prisma/client';

/** The editor loads its own cached doc before topics.scene, so any scene write it did not make must drop that cache. */
export async function dropEditorDoc(db: Pick<PrismaClient, 'canvasStoreDoc'>, topicKey: string): Promise<void> {
  await db.canvasStoreDoc.deleteMany({ where: { key: topicKey } });
}

import type { PrismaClient, Prisma, Topic } from '@prisma/client';

const MAX_HISTORY_PER_TOPIC = 10;

export async function snapshotScene(prisma: PrismaClient, topic: Topic): Promise<void> {
  if (!topic.scene || Object.keys(topic.scene as object).length === 0) {
    return;
  }

  await prisma.sceneHistory.create({
    data: { topicId: topic.id, scene: topic.scene as Prisma.InputJsonValue },
  });

  const excess = await prisma.sceneHistory.findMany({
    where: { topicId: topic.id },
    orderBy: { createdAt: 'desc' },
    skip: MAX_HISTORY_PER_TOPIC,
    select: { id: true },
  });

  if (excess.length > 0) {
    await prisma.sceneHistory.deleteMany({ where: { id: { in: excess.map((e) => e.id) } } });
  }
}

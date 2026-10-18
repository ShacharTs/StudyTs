import type { PrismaClient } from '@prisma/client';

export type TopicMove = { direction?: unknown; toIndex?: unknown };

/** Topics of one week section in display order; `id` breaks ties between rows that share a position. */
export const bySectionOrder = [{ position: 'asc' }, { id: 'asc' }] as const;

/** Where the topic at `from` ends up: an explicit `toIndex`, or one step up/down. Null when the request names neither. */
function targetIndex(move: TopicMove, from: number): number | null {
  if (move.direction === 'up') return from - 1;
  if (move.direction === 'down') return from + 1;
  if (typeof move.toIndex === 'number' && Number.isInteger(move.toIndex)) return move.toIndex;
  return null;
}

/**
 * Moves a topic inside its section and renumbers the whole section 0..n-1, so a swap of neighbours (1 4 3 2 → 1 2 3 4)
 * and a drag to any slot are the same operation. Returns the new order, or an error message for the caller to 400/404.
 */
export async function moveTopicInSection(
  prisma: PrismaClient,
  weekId: number,
  section: string,
  topicId: string,
  move: TopicMove,
): Promise<{ order: string[] } | { error: string; status: number }> {
  const rows = await prisma.topic.findMany({ where: { weekId, section }, orderBy: [...bySectionOrder], select: { id: true, topicId: true } });
  const from = rows.findIndex((row) => row.topicId === topicId);
  if (from < 0) return { error: `Topic '${topicId}' not found`, status: 404 };

  const to = targetIndex(move, from);
  if (to === null) return { error: "move needs direction 'up'|'down' or an integer toIndex", status: 400 };
  if (to < 0 || to >= rows.length) return { error: `Cannot move '${topicId}' to position ${to}`, status: 400 };

  const [moved] = rows.splice(from, 1);
  rows.splice(to, 0, moved);
  await prisma.$transaction(rows.map((row, position) => prisma.topic.update({ where: { id: row.id }, data: { position } })));
  return { order: rows.map((row) => row.topicId) };
}

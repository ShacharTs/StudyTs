import type { ToolboxItem, PaletteChip } from './toolboxTypes';

export type { PaletteChip };

export interface PaletteItem extends ToolboxItem {
  categoryId: string;
  categoryTitle: string;
}

/** 0 exact, 1 prefix, 2 substring, 3 subsequence, null no match. */
function fieldScore(field: string, q: string): number | null {
  if (field === q) return 0;
  if (field.startsWith(q)) return 1;
  if (field.includes(q)) return 2;
  let at = 0;
  for (const ch of field) if (ch === q[at]) at++;
  return at === q.length ? 3 : null;
}

function itemScore(item: PaletteItem, q: string): number | null {
  const fields = [item.label, item.id, ...(item.tags ?? []), item.categoryTitle];
  const scores = fields.map((f) => fieldScore(f.toLowerCase(), q)).filter((s): s is number => s !== null);
  return scores.length ? Math.min(...scores) : null;
}

/** Fuzzy search over label, id, tags and category title; blank query returns everything. Never uses RegExp. */
export function searchItems(items: PaletteItem[], query: string): PaletteItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items
    .map((item, index) => ({ item, index, score: itemScore(item, q) }))
    .filter((e): e is { item: PaletteItem; index: number; score: number } => e.score !== null)
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .map((e) => e.item);
}

export function filterByChip(items: PaletteItem[], chip: PaletteChip, favorites: Set<string>): PaletteItem[] {
  if (chip === 'all') return items;
  if (chip === 'favorites') return items.filter((i) => favorites.has(i.id));
  return items.filter((i) => i.chip === chip);
}

/** Ids of the most-inserted shapes (count > 0), skipping `exclude`; ties keep insertion order. */
export function rankFrequent(counts: Record<string, number>, exclude: Set<string>, n = 5): string[] {
  return Object.entries(counts)
    .filter(([id, count]) => count > 0 && !exclude.has(id))
    .map(([id, count], index) => ({ id, count, index }))
    .sort((a, b) => b.count - a.count || a.index - b.index)
    .slice(0, n)
    .map((e) => e.id);
}

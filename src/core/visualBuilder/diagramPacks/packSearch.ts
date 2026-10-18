import { val } from '../../../i18n/localizedValue';
import { categoryById } from './categoryRegistry';
import type { PackObjectDef, StylePackFile } from './stylePackFormat';
import { listPacks } from './stylePackRegistry';

export interface PackSearchHit {
  ref: string;
  packId: string;
  categoryId: string;
  object: PackObjectDef;
  score: number;
}

const PREFIX = 0;
const SUBSTRING = 1;
export const NO_MATCH = Infinity;

// Earlier fields outrank later ones; within a field a prefix outranks a substring.
export function textScore(query: string, fields: readonly string[]): number {
  const needle = query.trim().toLowerCase();
  if (needle === '') return 0;
  let best = NO_MATCH;
  fields.forEach((field, index) => {
    const text = field.toLowerCase();
    const kind = text.startsWith(needle) ? PREFIX : text.includes(needle) ? SUBSTRING : NO_MATCH;
    if (kind !== NO_MATCH) best = Math.min(best, index * 2 + kind);
  });
  return best;
}

function fieldsOf(pack: StylePackFile, object: PackObjectDef, categoryId: string, lang: string): string[] {
  const category = categoryById(categoryId);
  return [
    val(object.label, lang),
    object.label.en,
    ...(object.keywords ?? []),
    ...(object.aliases ?? []),
    val(pack.name, lang),
    pack.name.en,
    category ? val(category.label, lang) : '',
    category?.label.en ?? '',
  ].filter((field) => field !== '');
}

// An empty query returns every object in registry order; hits sort by score, then registry order.
export function searchPackObjects(query: string, lang: string): PackSearchHit[] {
  const hits = listPacks().flatMap((pack) =>
    pack.objects.map((object): PackSearchHit => {
      const categoryId = object.category ?? pack.category;
      return { ref: `${pack.id}/${object.id}`, packId: pack.id, categoryId, object, score: textScore(query, fieldsOf(pack, object, categoryId, lang)) };
    }),
  );
  return hits.filter((hit) => hit.score !== NO_MATCH).sort((a, b) => a.score - b.score);
}

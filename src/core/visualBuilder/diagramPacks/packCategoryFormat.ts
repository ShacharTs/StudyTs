import type { LocalizedLabel } from './stylePackFormat';

export const PACK_CATEGORY_FORMAT_VERSION = 1;
export const PACK_CATEGORY_ID_MAX_CHARS = 24;
export const PACK_CATEGORY_ORDER_MAX = 999;
export const PACK_CATEGORY_FIELDS = ['format', 'id', 'label', 'icon', 'order', 'description'] as const;

// A category is a data record: a pack names it by id, and the Insert gallery groups by `order`.
export interface PackCategoryFile {
  format: typeof PACK_CATEGORY_FORMAT_VERSION;
  id: string;
  label: LocalizedLabel;
  icon: string;
  order: number;
  description?: LocalizedLabel;
}

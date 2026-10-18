import type { FieldGroup, FieldSpec } from './schemas';

export type PropertyCategory = 'general' | 'dimensions' | 'colors' | 'more';

export const PROPERTY_CATEGORIES: readonly PropertyCategory[] = ['general', 'dimensions', 'colors', 'more'];

// Groups not listed here (and any future group) land in "more" so no field is ever unreachable.
const CATEGORY_BY_GROUP: Partial<Record<FieldGroup, PropertyCategory>> = {
  General: 'general',
  Text: 'general',
  Transform: 'dimensions',
  Appearance: 'colors',
  Behavior: 'general',
};

export function categoryOf(group: FieldGroup): PropertyCategory {
  return CATEGORY_BY_GROUP[group] ?? 'more';
}

export function fieldsInCategory(schema: FieldSpec[], category: PropertyCategory): FieldSpec[] {
  return schema.filter((f) => categoryOf(f.group) === category);
}

export function visibleCategories(schema: FieldSpec[]): PropertyCategory[] {
  return PROPERTY_CATEGORIES.filter((c) => fieldsInCategory(schema, c).length > 0);
}

import { INSERT_GALLERY_TEXT } from '../../i18n/dictionary';
import { val } from '../../i18n/localizedValue';
import { listTemplates } from './diagramPacks/buildTemplate';
import { listCategories } from './diagramPacks/categoryRegistry';
import { NO_MATCH, searchPackObjects, textScore } from './diagramPacks/packSearch';
import type { WorkspaceMode } from './modes/workspaceMode';
import { SHAPE_PRESETS, type PresetShape } from './shapeCatalog';

export type InsertCommand =
  | { kind: 'preset'; shape: PresetShape }
  | { kind: 'pack'; ref: string }
  | { kind: 'template'; id: string };

export interface GalleryCard {
  id: string;
  label: string;
  categoryLabel: string;
  keyHint?: string;
  command: InsertCommand;
}

export interface GallerySection {
  id: string;
  title: string;
  collapsed: boolean;
  cards: GalleryCard[];
}

// Order is the number-key order of the old Insert menu: key 1 is the first entry; shapes past NUMBER_KEYS have no key.
export const BASIC_SHAPES = ['circle', 'box', 'diamond', 'text', 'heading', 'caption', 'note', 'ellipse', 'rounded', 'triangle', 'line', 'arrow'] as const satisfies readonly PresetShape[];
const NUMBER_KEYS = 8;

const text = INSERT_GALLERY_TEXT;
const presetName = (shape: (typeof BASIC_SHAPES)[number], lang: string): string => val(text.presets[shape], lang);

type Scope = { preset: (shape: PresetShape) => boolean; category: (id: string) => boolean; template: (ref: string) => boolean };

const EVERYTHING: Scope = { preset: () => true, category: () => true, template: () => true };

// A null filter list means "all" (the Free mode); an empty one means none. A mode that lists templates shows only those.
const scopeOf = (mode: WorkspaceMode | undefined): Scope => {
  if (!mode) return EVERYTHING;
  const { presets, categories } = mode.filters;
  return {
    preset: (shape) => presets === null || presets.includes(shape),
    category: (id) => categories === null || categories.includes(id),
    template: (ref) => mode.templates.length === 0 || mode.templates.includes(ref),
  };
};

const invert = (scope: Scope): Scope => ({ preset: (shape) => !scope.preset(shape), category: (id) => !scope.category(id), template: (ref) => !scope.template(ref) });

function basicCards(lang: string, query: string, scope: Scope): GalleryCard[] {
  const basic = val(text.basic, lang);
  return BASIC_SHAPES.flatMap((shape, index) => {
    if (!scope.preset(shape)) return [];
    const english = SHAPE_PRESETS.find((preset) => preset.shape === shape)?.label ?? shape;
    if (textScore(query, [presetName(shape, lang), english, shape]) === NO_MATCH) return [];
    return [{ id: `preset:${shape}`, label: presetName(shape, lang), categoryLabel: basic, ...(index < NUMBER_KEYS && { keyHint: String(index + 1) }), command: { kind: 'preset', shape } as const }];
  });
}

function templateCards(lang: string, query: string, listed: readonly string[], scope: Scope): GalleryCard[] {
  const categoryLabel = val(text.templates, lang);
  const rank = (ref: string) => (listed.includes(ref) ? listed.indexOf(ref) : listed.length);
  const ordered = [...listTemplates()].sort((a, b) => rank(a.ref) - rank(b.ref));
  return ordered.flatMap(({ ref, def }) => {
    if (!scope.template(ref)) return [];
    const label = val(def.name, lang);
    if (textScore(query, [label, def.name.en, def.description.en, categoryLabel]) === NO_MATCH) return [];
    return [{ id: `template:${ref}`, label, categoryLabel, command: { kind: 'template', id: ref } as const }];
  });
}

function categorySections(lang: string, query: string, scope: Scope): GallerySection[] {
  const hits = searchPackObjects(query, lang);
  return listCategories().filter((category) => scope.category(category.id)).flatMap((category) => {
    const title = val(category.label, lang);
    const cards = hits
      .filter((hit) => hit.categoryId === category.id)
      .map((hit): GalleryCard => ({ id: `pack:${hit.ref}`, label: val(hit.object.label, lang), categoryLabel: title, command: { kind: 'pack', ref: hit.ref } }));
    return cards.length > 0 ? [{ id: `category:${category.id}`, title, collapsed: false, cards }] : [];
  });
}

// What a mode hides is still findable: a search lists those hits under one extra section.
function outsideSection(lang: string, query: string, scope: Scope): GallerySection[] {
  if (query.trim() === '') return [];
  const away = invert(scope);
  const cards = [...basicCards(lang, query, away), ...categorySections(lang, query, away).flatMap((section) => section.cards), ...templateCards(lang, query, [], away)];
  return [{ id: 'outside', title: val(text.outsideMode, lang), collapsed: false, cards }];
}

// Basic presets, then one section per category that has a hit, then the pack templates (collapsed until searched).
// A mode narrows presets and categories and lists its templates first; showAll lifts the narrowing.
export function galleryModel(lang: string, query: string, mode?: WorkspaceMode, showAll = false): GallerySection[] {
  const scope = showAll ? EVERYTHING : scopeOf(mode);
  const listed = showAll ? [] : mode?.templates ?? [];
  const templates: GallerySection = { id: 'templates', title: val(text.templates, lang), collapsed: listed.length === 0, cards: templateCards(lang, query, listed, scope) };
  const basic: GallerySection = { id: 'basic', title: val(text.basic, lang), collapsed: false, cards: basicCards(lang, query, scope) };
  const categories = categorySections(lang, query, scope);
  const sections = listed.length > 0 ? [basic, templates, ...categories] : [basic, ...categories, templates];
  return [...sections, ...(showAll ? [] : outsideSection(lang, query, scope))].filter((section) => section.cards.length > 0);
}

import type { ToolboxCategory } from './toolboxTypes';
import { SHAPE_DEFINITIONS } from '../shapeEngine/shapeDefinitions';
import { spawnItem } from './spawnItem';
import { ShapeGlyph } from './ShapeGlyph';
import { BasicShapesCategory } from './categories/basicShapes';
import { AutomataGraphCategory } from './categories/automataGraph';
import { UmlDiagramsCategory } from './categories/umlDiagrams';
import { SystemDesignCategory, NetworkCategory } from './categories/presetCategories';
import type { PaletteChip, PaletteItem } from './paletteModel';

export const TOOLBOX_CATEGORIES: ToolboxCategory[] = [
  BasicShapesCategory,
  AutomataGraphCategory,
  UmlDiagramsCategory,
  SystemDesignCategory,
  NetworkCategory,
];

/** Filter chip each category feeds (basic shapes only appear under "All"). */
const CATEGORY_CHIP: Record<string, PaletteChip> = {
  'automata-graph': 'automata',
  'uml-diagrams': 'uml',
  'system-design': 'system',
  network: 'network',
  'custom-shapes': 'uml',
};

/** Every palette entry flattened, with its category and chip attached (what search and the chips work on). */
export function getPaletteItems(): PaletteItem[] {
  return getToolboxCategories().flatMap((cat) =>
    cat.items.map((item) => ({
      ...item,
      categoryId: cat.id,
      categoryTitle: cat.title,
      chip: item.chip ?? CATEGORY_CHIP[cat.id],
    }))
  );
}

/** Built-in categories plus a "Custom Shapes" category generated from every registered custom definition. */
export function getToolboxCategories(): ToolboxCategory[] {
  const custom = Object.values(SHAPE_DEFINITIONS).filter((d) => d.category === 'custom');
  if (custom.length === 0) return TOOLBOX_CATEGORIES;
  return [
    ...TOOLBOX_CATEGORIES,
    {
      id: 'custom-shapes',
      title: 'Custom Shapes',
      items: custom.map((d) => ({
        id: `shape-def-${d.id}`,
        label: d.name,
        icon: <ShapeGlyph />,
        onSelect: (pageId: string) =>
          spawnItem(pageId, 'shape', { shape: d.id }, { w: d.defaultDimensions.width, h: d.defaultDimensions.height }),
      })),
    },
  ];
}

import automataGraphCategory from './categories/automata-graph.category.json';
import dataCategory from './categories/data.category.json';
import flowchartCategory from './categories/flowchart.category.json';
import networkCategory from './categories/network.category.json';
import setsCategory from './categories/sets.category.json';
import shapesCategory from './categories/shapes.category.json';
import systemCategory from './categories/system.category.json';
import umlCategory from './categories/uml.category.json';
import type { PackCategoryFile } from './packCategoryFormat';
import type { StylePackIssue } from './stylePackFormat';
import { validatePackCategory } from './validatePackCategory';

export interface CategorySource {
  file: string;
  raw: unknown;
}

export interface CategoryRegistry {
  listCategories(): readonly PackCategoryFile[];
  categoryById(categoryId: string): PackCategoryFile | undefined;
}

export interface CategoryLoadIssue extends StylePackIssue {
  file: string;
}

// Explicit imports, as in stylePackRegistry: a new category needs its import line here.
export const BUILT_IN_CATEGORY_SOURCES: readonly CategorySource[] = [
  { file: 'shapes.category.json', raw: shapesCategory },
  { file: 'uml.category.json', raw: umlCategory },
  { file: 'sets.category.json', raw: setsCategory },
  { file: 'network.category.json', raw: networkCategory },
  { file: 'system.category.json', raw: systemCategory },
  { file: 'automata-graph.category.json', raw: automataGraphCategory },
  { file: 'data.category.json', raw: dataCategory },
  { file: 'flowchart.category.json', raw: flowchartCategory },
];

// Validation runs in every environment: a bad built-in category must stop the app at startup, not sort the gallery wrongly.
export class CategoryRegistryError extends Error {
  readonly issues: readonly CategoryLoadIssue[];

  constructor(issues: readonly CategoryLoadIssue[]) {
    super(formatLoadIssues(issues));
    this.name = 'CategoryRegistryError';
    this.issues = issues;
  }
}

export function createCategoryRegistry(sources: readonly CategorySource[]): CategoryRegistry {
  const categories = loadCategories(sources);
  const categoriesById = new Map(categories.map((category) => [category.id, category] as const));
  return {
    listCategories: () => categories,
    categoryById: (categoryId) => categoriesById.get(categoryId),
  };
}

function loadCategories(sources: readonly CategorySource[]): PackCategoryFile[] {
  const issues: CategoryLoadIssue[] = [];
  const declaringFileById = new Map<string, string>();
  const declaringFileByOrder = new Map<number, string>();
  const categories: PackCategoryFile[] = [];
  for (const { file, raw } of sources) {
    const result = validatePackCategory(raw);
    if (!result.ok) {
      issues.push(...result.errors.map((error) => ({ ...error, file })));
      continue;
    }
    const { category } = result;
    const takenId = declaringFileById.get(category.id);
    if (takenId !== undefined) {
      issues.push({ file, path: 'category.id', code: 'duplicate-id', message: `${category.id} is already declared by ${takenId}` });
      continue;
    }
    const takenOrder = declaringFileByOrder.get(category.order);
    if (takenOrder !== undefined) {
      issues.push({ file, path: 'category.order', code: 'bad-value', message: `order ${category.order} is already used by ${takenOrder}` });
      continue;
    }
    declaringFileById.set(category.id, file);
    declaringFileByOrder.set(category.order, file);
    categories.push(category);
  }
  if (issues.length > 0) throw new CategoryRegistryError(issues);
  return [...categories].sort((a, b) => a.order - b.order);
}

function formatLoadIssues(issues: readonly CategoryLoadIssue[]): string {
  const lines = issues.map((issue) => `  ${issue.file} ${issue.path}: ${issue.message}`);
  return [`Invalid pack categor${issues.length === 1 ? 'y' : 'ies'} (${issues.length}):`, ...lines].join('\n');
}

const builtInRegistry = createCategoryRegistry(BUILT_IN_CATEGORY_SOURCES);

export const listCategories = builtInRegistry.listCategories;
export const categoryById = builtInRegistry.categoryById;

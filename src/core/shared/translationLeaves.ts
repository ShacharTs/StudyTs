// Pure leaf traversal: takes the namespace objects as an argument so server code never loads the i18n dictionary.

export type TranslationLeaf = { en: string } & Record<string, string | undefined>;

function isLeaf(node: unknown): node is TranslationLeaf {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return false;
  const candidate = node as Record<string, unknown>;
  return typeof candidate.en === 'string';
}

export function collectTranslationLeaves(namespaces: Record<string, object>): Map<string, TranslationLeaf> {
  const leaves = new Map<string, TranslationLeaf>();

  function walk(current: Record<string, unknown>, prefix: string): void {
    for (const [key, value] of Object.entries(current)) {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
      const path = prefix ? `${prefix}.${key}` : key;
      if (isLeaf(value)) {
        leaves.set(path, value);
      } else if (value && typeof value === 'object' && !Array.isArray(value)) {
        walk(value as Record<string, unknown>, path);
      }
    }
  }

  walk(namespaces as Record<string, unknown>, '');
  return leaves;
}

export function leavesFromSnapshot(snapshot: Record<string, TranslationLeaf>): Map<string, TranslationLeaf> {
  return new Map(Object.entries(snapshot));
}

export function serializeLeafSnapshot(leaves: Map<string, TranslationLeaf>): string {
  return JSON.stringify(Object.fromEntries(leaves), null, 2) + '\n';
}

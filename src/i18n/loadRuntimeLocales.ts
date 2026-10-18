// Fetches and registers runtime locale packs on client boot.

import { LOCALE_FETCH_TIMEOUT_MS } from './localePackLimits.js';
import { validateLocalePack, PackCoverage } from './localePack.js';
import { getTranslationLeaves, TranslationLeaf } from './translationKeys.js';
import { applyLocalePack } from './applyLocalePack.js';

interface LocaleSummary {
  code: string;
  nativeName: string;
  englishName: string;
  dir: 'ltr' | 'rtl';
  flag: string;
  translated: number;
  total: number;
}

async function fetchSinglePack(
  code: string,
  fetchImpl: typeof fetch,
  signal: AbortSignal | undefined,
  knownKeys: ReadonlySet<string>,
  leaves: Map<string, TranslationLeaf>
): Promise<PackCoverage | null> {
  try {
    const packRes = await fetchImpl(`/api/locales/${encodeURIComponent(code)}`, { signal });
    if (!packRes.ok) return null;

    const rawPack = await packRes.json();
    const { pack } = validateLocalePack(rawPack, knownKeys);
    return pack ? applyLocalePack(pack, leaves) : null;
  } catch {
    return null;
  }
}

export async function loadRuntimeLocales(
  fetchImpl: typeof fetch = fetch,
  timeoutMs = LOCALE_FETCH_TIMEOUT_MS
): Promise<PackCoverage[]> {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

  try {
    const listRes = await fetchImpl('/api/locales', { signal: controller?.signal });
    if (!listRes.ok) return [];

    const summaries = (await listRes.json()) as LocaleSummary[];
    if (!Array.isArray(summaries) || summaries.length === 0) return [];

    const leaves = getTranslationLeaves();
    const knownKeys = new Set(leaves.keys());
    const coverages: PackCoverage[] = [];

    for (const summary of summaries) {
      const cov = await fetchSinglePack(summary.code, fetchImpl, controller?.signal, knownKeys, leaves);
      if (cov) coverages.push(cov);
    }

    return coverages;
  } catch {
    return [];
  } finally {
    if (timer) clearTimeout(timer);
  }
}

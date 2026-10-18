import { create } from 'zustand';
import { STORAGE_KEYS } from '@core/shared/storageKeys';

export const PALETTE_KEY = STORAGE_KEYS.canvasPalette;

interface Persisted {
  favorites: string[];
  counts: Record<string, number>;
}

interface PaletteState extends Persisted {
  toggleFavorite(id: string): void;
  recordInsert(id: string): void;
  pruneUnknown(validIds: Set<string>): void;
}

function isCounts(v: unknown): v is Record<string, number> {
  return (
    typeof v === 'object' && v !== null && !Array.isArray(v) &&
    Object.values(v).every((n) => typeof n === 'number' && Number.isFinite(n))
  );
}

/** Reads the stored palette; anything malformed (or blocked storage) yields an empty palette. */
function readPalette(): Persisted {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(PALETTE_KEY) ?? 'null');
    if (typeof raw !== 'object' || raw === null) return { favorites: [], counts: {} };
    const { favorites, counts } = raw as Partial<Persisted>;
    const okFavorites = Array.isArray(favorites) && favorites.every((f) => typeof f === 'string');
    return { favorites: okFavorites ? favorites : [], counts: isCounts(counts) ? counts : {} };
  } catch {
    return { favorites: [], counts: {} };
  }
}

function write(state: Persisted): void {
  try {
    localStorage.setItem(PALETTE_KEY, JSON.stringify({ favorites: state.favorites, counts: state.counts }));
  } catch {
    // Storage can be blocked or full; the palette keeps working for this session.
  }
}

export function createPaletteStore() {
  return create<PaletteState>((set, get) => {
    const commit = (next: Persisted) => {
      set(next);
      write(next);
    };
    return {
      ...readPalette(),
      toggleFavorite: (id) => {
        const { favorites, counts } = get();
        commit({ counts, favorites: favorites.includes(id) ? favorites.filter((f) => f !== id) : [...favorites, id] });
      },
      recordInsert: (id) => {
        const { favorites, counts } = get();
        commit({ favorites, counts: { ...counts, [id]: (counts[id] ?? 0) + 1 } });
      },
      pruneUnknown: (validIds) => {
        const { favorites, counts } = get();
        commit({
          favorites: favorites.filter((f) => validIds.has(f)),
          counts: Object.fromEntries(Object.entries(counts).filter(([id]) => validIds.has(id))),
        });
      },
    };
  });
}

export const usePaletteStore = createPaletteStore();

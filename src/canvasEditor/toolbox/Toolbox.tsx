import { useEffect, useState, type ReactNode } from 'react';
import { useCanvasStore } from '@canvasStore';
import { getPaletteItems } from './toolboxRegistry';
import { filterByChip, rankFrequent, searchItems, type PaletteChip, type PaletteItem } from './paletteModel';
import { usePaletteStore } from './usePaletteStore';
import styles from './Toolbox.module.css';
import { ChevronDown, Star, Search, LayoutGrid, Boxes, Workflow, PenTool, Network, type LucideIcon } from 'lucide-react';
import { useTranslation } from '@i18n';
import type { ToolboxItem } from './toolboxTypes';

// Each segment keeps its filter id; the icon stands in for the text label, which becomes the accessible name.
const CHIPS: Array<[PaletteChip, LucideIcon]> = [
  ['all', LayoutGrid],
  ['favorites', Star],
  ['uml', Boxes],
  ['automata', Workflow],
  ['system', PenTool],
  ['network', Network],
];

interface Props {
  query: string;
  onQuery: (q: string) => void;
  chip: PaletteChip;
  onChip: (c: PaletteChip) => void;
}

/** Persistent search box with quick filter chips. */
function ToolboxSearch({ query, onQuery, chip, onChip }: Props) {
  const { val } = useTranslation();
  return (
    <div className={styles.searchArea}>
      <label className={styles.searchBox}>
        <Search size={14} aria-hidden="true" />
        <input
          type="search"
          className={styles.searchInput}
          value={query}
          placeholder="Search shapes"
          aria-label="Search shapes"
          onChange={(e) => onQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onQuery('');
          }}
        />
      </label>
      <div className={styles.chips}>
        {CHIPS.map(([id, Icon]) => (
          <button
            key={id}
            type="button"
            className={chip === id ? styles.chipActive : styles.chip}
            aria-pressed={chip === id}
            aria-label={val({ key: `canvasBlocks.toolbox.chips.${id}` })}
            title={val({ key: `canvasBlocks.toolbox.chips.${id}` })}
            onClick={() => onChip(id)}
          >
            <Icon size={14} aria-hidden="true" />
          </button>
        ))}
      </div>
    </div>
  );
}

interface ToolboxItemButtonProps {
  item: ToolboxItem;
  query: string;
  pinned: boolean;
  onInsert: () => void;
  onTogglePin: () => void;
}

/** Label with the first case-insensitive match of the query wrapped in <mark>. */
function Highlighted({ label, query }: { label: string; query: string }) {
  const q = query.trim().toLowerCase();
  const at = q ? label.toLowerCase().indexOf(q) : -1;
  if (at < 0) return <>{label}</>;
  return (
    <>
      {label.slice(0, at)}
      <mark>{label.slice(at, at + q.length)}</mark>
      {label.slice(at + q.length)}
    </>
  );
}

/** One palette entry: the insert button plus a hover/focus star that pins it to Favorites. */
function ToolboxItemButton({ item, query, pinned, onInsert, onTogglePin }: ToolboxItemButtonProps) {
  return (
    <div className={styles.itemWrap}>
      <button className={styles.itemBtn} onClick={onInsert} title={item.label}>
        <span className={styles.itemIcon}>{item.icon}</span>
        <span className={styles.itemLabel}>
          <Highlighted label={item.label} query={query} />
        </span>
      </button>
      <button
        type="button"
        className={pinned ? styles.starPinned : styles.star}
        aria-pressed={pinned}
        aria-label={`${pinned ? 'Unpin' : 'Pin'} ${item.label}`}
        onClick={onTogglePin}
      >
        <Star size={12} fill={pinned ? 'currentColor' : 'none'} />
      </button>
    </div>
  );
}

interface CategorySectionProps {
  title: string;
  collapsed: boolean;
  onToggle: () => void;
  children: ReactNode;
}

/** A collapsible palette section: header button plus its grid of items. */
function CategorySection({ title, collapsed, onToggle, children }: CategorySectionProps) {
  return (
    <div>
      <button type="button" className={styles.categoryHeader} onClick={onToggle} aria-expanded={!collapsed}>
        <span>{title}</span>
        <ChevronDown size={14} className={collapsed ? styles.categoryChevronCollapsed : styles.categoryChevron} />
      </button>
      {!collapsed && <div className={styles.itemGrid}>{children}</div>}
    </div>
  );
}

const QUICK_ACCESS = 'quick-access';

interface Group {
  id: string;
  title: string;
  items: PaletteItem[];
}

/** Items grouped by category, keeping the registry's category order. */
function groupByCategory(items: PaletteItem[]): Group[] {
  const groups = new Map<string, Group>();
  for (const item of items) {
    const g = groups.get(item.categoryId) ?? { id: item.categoryId, title: item.categoryTitle, items: [] };
    g.items.push(item);
    groups.set(item.categoryId, g);
  }
  return [...groups.values()];
}

function lookup(ids: string[], byId: Map<string, PaletteItem>): PaletteItem[] {
  return ids.map((id) => byId.get(id)).filter((i): i is PaletteItem => !!i);
}

export function Toolbox() {
  const currentPageId = useCanvasStore((s) => s.currentPageId);
  const { favorites, counts, toggleFavorite, recordInsert, pruneUnknown } = usePaletteStore();
  const [query, setQuery] = useState('');
  const [chip, setChip] = useState<PaletteChip>('all');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const all = getPaletteItems();
  const byId = new Map(all.map((i) => [i.id, i]));

  // Drop pins and counters for deleted shapes on mount.
  useEffect(() => pruneUnknown(new Set(getPaletteItems().map((i) => i.id))), [pruneUnknown]);

  const toggleSection = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const searching = query.trim() !== '';
  const visible = searchItems(filterByChip(all, chip, new Set(favorites)), query);
  const pinned = lookup(favorites, byId);
  const frequent = lookup(rankFrequent(counts, new Set(favorites)), byId);
  const showQuick = !searching && chip === 'all' && pinned.length + frequent.length > 0;

  const entry = (item: PaletteItem, key: string) => (
    <ToolboxItemButton
      key={key}
      item={item}
      query={query}
      pinned={favorites.includes(item.id)}
      onInsert={() => {
        item.onSelect(currentPageId);
        recordInsert(item.id);
      }}
      onTogglePin={() => toggleFavorite(item.id)}
    />
  );

  return (
    <div className={styles.toolbox}>
      <ToolboxSearch query={query} onQuery={setQuery} chip={chip} onChip={setChip} />
      {showQuick && (
        <CategorySection title="Favorites / Quick Access" collapsed={collapsed.has(QUICK_ACCESS)} onToggle={() => toggleSection(QUICK_ACCESS)}>
          {pinned.map((i) => entry(i, `pin-${i.id}`))}
          {frequent.length > 0 && <p className={styles.subHeading}>Frequently used</p>}
          {frequent.map((i) => entry(i, `freq-${i.id}`))}
        </CategorySection>
      )}
      {groupByCategory(visible).map((cat) => (
        <CategorySection key={cat.id} title={cat.title} collapsed={!searching && collapsed.has(cat.id)} onToggle={() => toggleSection(cat.id)}>
          {cat.items.map((i) => entry(i, i.id))}
        </CategorySection>
      ))}
      {(searching || chip !== 'all') && visible.length === 0 && <p className={styles.empty}>No shapes match</p>}
    </div>
  );
}

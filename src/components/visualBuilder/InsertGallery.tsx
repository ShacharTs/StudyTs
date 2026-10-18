import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { INSERT_GALLERY_TEXT, useTranslation } from '@i18n';
import type { WorkspaceMode } from '@core/visualBuilder/modes/workspaceMode';
import { galleryModel, type GalleryCard, type GallerySection, type InsertCommand } from '@core/visualBuilder/galleryModel';
import { controlClass } from './controls/controlClass';
import { ControlIcon } from './controls/controlIcons';
import { ShapeThumb } from './ShapeThumb';
import { useGalleryKeyboard } from './useGalleryKeyboard';
import { usePopoutFit } from './usePopoutFit';
import styles from './InsertGallery.module.css';

interface InsertGalleryProps {
  stepNumber: number;
  onInsert: (command: InsertCommand) => void;
  // Each increase opens the panel, so a context menu can ask for it without owning its state.
  openRequest?: number;
  mode?: WorkspaceMode;
  showAll?: boolean;
}

interface PanelProps extends InsertGalleryProps {
  trigger: RefObject<HTMLButtonElement>;
  onClose: () => void;
}

interface PlacedSection {
  section: GallerySection;
  expanded: boolean;
  start: number;
}

const text = INSERT_GALLERY_TEXT;
const ALL_SECTIONS = 'all';

// Cards of a collapsed section are not in the tab or arrow order; start is the section's first index in that order.
function placeSections(sections: GallerySection[], showTemplates: boolean, searching: boolean): PlacedSection[] {
  let start = 0;
  return sections.map((section) => {
    const expanded = !section.collapsed || showTemplates || searching;
    const placed = { section, expanded, start };
    if (expanded) start += section.cards.length;
    return placed;
  });
}

function gridColumns(root: HTMLElement | null): number {
  const grid = root?.querySelector('[data-grid]');
  const tracks = grid ? getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length : 1;
  return Math.max(1, tracks);
}

function InsertPanel({ stepNumber, trigger, onInsert, onClose, mode, showAll }: PanelProps) {
  const { lang, val, isRtl, direction } = useTranslation();
  const [query, setQuery] = useState('');
  const [showTemplates, setShowTemplates] = useState(false);
  const [filter, setFilter] = useState<string>(ALL_SECTIONS);
  const root = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  usePopoutFit(root, { anchor: trigger, align: 'start' });

  const sections = useMemo(() => galleryModel(lang, query, mode, showAll), [lang, query, mode, showAll]);
  const placed = useMemo(
    () => placeSections(sections.filter((section) => filter === ALL_SECTIONS || section.id === filter), showTemplates, query.trim() !== ''),
    [sections, filter, showTemplates, query],
  );
  const cards = placed.filter((entry) => entry.expanded).flatMap((entry) => entry.section.cards);

  const activate = (card: GalleryCard, keepOpen: boolean) => {
    onInsert(card.command);
    if (!keepOpen) onClose();
  };

  const keyboard = useGalleryKeyboard({
    cards,
    rtl: isRtl,
    columns: () => gridColumns(root.current),
    onActivate: activate,
    onClose,
    focusSearch: () => search.current?.focus(),
  });

  useEffect(() => search.current?.focus(), []);
  useEffect(() => {
    const closeOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!root.current?.contains(target) && !trigger.current?.contains(target)) onClose();
    };
    document.addEventListener('mousedown', closeOutside);
    return () => document.removeEventListener('mousedown', closeOutside);
  }, [onClose, trigger]);

  return createPortal(
    <div role="dialog" aria-label={val(text.title)} dir={direction} className={styles.panel} ref={root} onKeyDown={keyboard.onKeyDown}>
      <h3 className={styles.title}>
        {val(text.title)}
        {stepNumber > 1 && <span className={styles.titleNote}>{val(text.atStep).replace('{n}', String(stepNumber))}</span>}
      </h3>
      <input
        ref={search}
        type="search"
        className={styles.search}
        aria-label={val(text.searchLabel)}
        placeholder={val(text.searchPlaceholder)}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <div className={styles.filters} role="radiogroup" aria-label={val(text.filterLabel)}>
        {[{ id: ALL_SECTIONS, title: val(text.filterAll) }, ...sections.map((section) => ({ id: section.id, title: section.title }))].map((option) => (
          <button key={option.id} type="button" role="radio" aria-checked={filter === option.id} className={`${styles.filter} ${filter === option.id ? styles.filterOn : ''}`} onClick={() => setFilter(option.id)}>
            {option.title}
          </button>
        ))}
      </div>
      {placed.length === 0 && <p className={styles.empty}>{val(text.noResults)}</p>}
      {placed.map(({ section, expanded, start }) => (
        <section key={section.id} className={styles.section} aria-label={section.title}>
          <h4 className={styles.sectionTitle}>
            {section.collapsed ? (
              <button type="button" className={styles.sectionToggle} aria-expanded={expanded} onClick={() => setShowTemplates((was) => !was)}>
                {expanded ? '▾' : isRtl ? '◂' : '▸'} {section.title}
              </button>
            ) : section.title}
          </h4>
          {expanded && (
            <div className={styles.cards} data-grid>
              {section.cards.map((card, offset) => (
                <GalleryCardButton key={card.id} card={card} index={start + offset} keyboard={keyboard} onActivate={activate} />
              ))}
            </div>
          )}
        </section>
      ))}
      {query.trim() === '' && <p className={styles.note}>{val(text.stylePacks)}: {val(text.stylePacksNote)}</p>}
    </div>,
    // The --wb-* tokens live on the workbench root, so the panel must stay under it; body would leave it unstyled and see-through.
    trigger.current?.closest('[data-workbench]') ?? document.body,
  );
}

interface CardButtonProps {
  card: GalleryCard;
  index: number;
  keyboard: ReturnType<typeof useGalleryKeyboard>;
  onActivate: (card: GalleryCard, keepOpen: boolean) => void;
}

function GalleryCardButton({ card, index, keyboard, onActivate }: CardButtonProps) {
  return (
    <button
      ref={keyboard.cardRef(index)}
      type="button"
      data-card
      className={styles.card}
      tabIndex={index === keyboard.active ? 0 : -1}
      aria-label={`${card.label}, ${card.categoryLabel}`}
      onFocus={() => keyboard.setActive(index)}
      onClick={(event) => onActivate(card, event.shiftKey)}
    >
      <span className={styles.thumbBox}><ShapeThumb command={card.command} /></span>
      <b className={styles.cardName}>{card.label}</b>
      {card.keyHint && <kbd className={styles.keyHint}>{card.keyHint}</kbd>}
    </button>
  );
}

export function InsertGallery(props: InsertGalleryProps) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const { val } = useTranslation();
  const { openRequest } = props;

  useEffect(() => {
    if (openRequest) setOpen(true);
  }, [openRequest]);

  // Escape and a finished insert both hand focus back to the button that opened the panel.
  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };

  return (
    <>
      <button ref={trigger} type="button" className={controlClass(undefined)} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((was) => !was)}>
        <ControlIcon name="insert" />
        {val(text.title)}
      </button>
      {open && <InsertPanel {...props} trigger={trigger} onClose={close} />}
    </>
  );
}

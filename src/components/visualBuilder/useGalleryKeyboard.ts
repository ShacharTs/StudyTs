import { useRef, useState, type KeyboardEvent } from 'react';
import type { GalleryCard } from '@core/visualBuilder/galleryModel';
import { NAVIGATION_KEYS, nextCardIndex } from '@core/visualBuilder/nextCardIndex';

interface GalleryKeyboardOptions {
  cards: GalleryCard[];
  columns: () => number;
  rtl: boolean;
  onActivate: (card: GalleryCard, keepOpen: boolean) => void;
  onClose: () => void;
  focusSearch: () => void;
}

const isNavigation = (key: string): boolean => (NAVIGATION_KEYS as readonly string[]).includes(key);
const isPrintable = (event: KeyboardEvent): boolean => event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey;

export function useGalleryKeyboard(options: GalleryKeyboardOptions) {
  const { cards, columns, rtl, onActivate, onClose, focusSearch } = options;
  const [rawActive, setActive] = useState(0);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const active = Math.min(rawActive, Math.max(0, cards.length - 1));

  const focusCard = (index: number) => {
    setActive(index);
    refs.current[index]?.focus();
  };

  const searchKey = (event: KeyboardEvent) => {
    if (event.key === 'Enter' && cards[0]) {
      event.preventDefault();
      onActivate(cards[0], event.shiftKey);
    }
    if (event.key === 'ArrowDown' && cards.length > 0) {
      event.preventDefault();
      focusCard(0);
    }
  };

  const onCardOf = (event: KeyboardEvent): boolean => (event.target as HTMLElement).closest('[data-card]') !== null;

  // Handled here so Shift is known; the browser's synthetic click would not carry it reliably.
  const enterKey = (event: KeyboardEvent): boolean => {
    if (!onCardOf(event) || event.key !== 'Enter' || !cards[active]) return false;
    event.preventDefault();
    onActivate(cards[active], event.shiftKey);
    return true;
  };

  const moveKey = (event: KeyboardEvent): boolean => {
    if (!onCardOf(event) || !isNavigation(event.key)) return false;
    event.preventDefault();
    focusCard(nextCardIndex(active, event.key, columns(), rtl, cards.length));
    return true;
  };

  const hintKey = (event: KeyboardEvent): boolean => {
    const card = event.ctrlKey || event.metaKey ? undefined : cards.find((candidate) => candidate.keyHint === event.key);
    if (!card) return false;
    event.preventDefault();
    onActivate(card, event.shiftKey);
    return true;
  };

  const typeKey = (event: KeyboardEvent): boolean => {
    if (!isPrintable(event)) return false;
    if (event.key === '/') event.preventDefault();
    focusSearch();
    return true;
  };

  const gridKey = (event: KeyboardEvent) => enterKey(event) || moveKey(event) || hintKey(event) || typeKey(event);

  // Every key stops here: the builder's own shortcuts (arrows nudge, Enter edits) must not fire behind an open panel.
  const onKeyDown = (event: KeyboardEvent) => {
    event.stopPropagation();
    if (event.key === 'Escape') {
      onClose();
      return;
    }
    if ((event.target as HTMLElement).tagName === 'INPUT') searchKey(event);
    else gridKey(event);
  };

  const cardRef = (index: number) => (element: HTMLButtonElement | null) => {
    refs.current[index] = element;
  };

  return { active, setActive, onKeyDown, cardRef };
}

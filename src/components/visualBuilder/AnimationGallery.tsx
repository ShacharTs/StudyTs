import { useEffect, useRef, type KeyboardEvent, type RefObject } from 'react';
import { usePopoutFit } from './usePopoutFit';
import { EFFECTS, OBJECT_KINDS, effectsFor, type EffectDef, type EffectId, type ObjectKind } from '@core/visualBuilder/effects';
import { BUILDER_TEXT, useTranslation, type TranslateFn } from '@i18n';
import { EffectDemo } from './EffectDemo';
import styles from './BuilderWorkbench.module.css';

interface AnimationGalleryProps {
  selectionKind: ObjectKind | null;
  onApply: (effect: EffectId) => void;
  onPick: (effect: EffectDef) => void;
  onClose: () => void;
  // The active mode's effect ids; empty keeps every effect.
  allowedEffects?: readonly string[];
  // The Animate button: the pop-out opens under it, like the Mode and Insert menus.
  anchor?: RefObject<HTMLElement>;
}

const text = BUILDER_TEXT;

const KIND_KEY: Record<ObjectKind, keyof typeof BUILDER_TEXT> = {
  arrow: 'edKindArrows',
  closed: 'edKindShapes',
  box: 'edKindBoxes',
  text: 'edKindText',
  path: 'edKindLines',
};

const effectKey = (id: string, suffix = ''): string => `edEffect${id.charAt(0).toUpperCase()}${id.slice(1)}${suffix}`;

// A pack effect has no table entry, so its own English label and description stay.
function translatedOr(key: string, fallback: string, val: TranslateFn): string {
  const entry = (BUILDER_TEXT as Record<string, unknown>)[key];
  return entry === undefined ? fallback : val(entry);
}

// Core kindsWord is English-only, so the same wording is rebuilt here in the current language.
function kindsLabel(kinds: readonly ObjectKind[], val: TranslateFn): string {
  if (kinds.length === OBJECT_KINDS.length) return val(text.edAnyObject);
  return kinds.map((kind) => val(text[KIND_KEY[kind]])).join(` ${val(text.edOr)} `);
}

// With a selection the gallery offers only what fits it; with none, every card starts a pick.
const cardsFor = (selectionKind: ObjectKind | null, allowed: readonly string[]): EffectDef[] =>
  selectionKind === null ? EFFECTS.filter((effect) => allowed.length === 0 || allowed.includes(effect.id)) : effectsFor(selectionKind, allowed);

export function AnimationGallery({ selectionKind, onApply, onPick, onClose, allowedEffects = [], anchor }: AnimationGalleryProps) {
  const { val } = useTranslation();
  const root = useRef<HTMLDivElement>(null);
  const first = useRef<HTMLButtonElement>(null);
  usePopoutFit(root, { anchor, align: 'start' });

  useEffect(() => first.current?.focus(), []);
  useEffect(() => {
    const closeOutside = (event: MouseEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) onClose();
    };
    document.addEventListener('mousedown', closeOutside);
    return () => document.removeEventListener('mousedown', closeOutside);
  }, [onClose]);

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Escape') return;
    event.stopPropagation();
    onClose();
  };

  return (
    <div role="dialog" aria-label={val(text.edChooseAnimation)} className={styles.gallery} ref={root} onKeyDown={onKeyDown}>
      <h3 className={styles.galleryTitle}>{val(text.edChooseAnimation)}</h3>
      <div className={styles.cards}>
        {cardsFor(selectionKind, allowedEffects).map((effect, index) => (
          <button
            key={effect.id}
            type="button"
            ref={index === 0 ? first : undefined}
            className={styles.card}
            onClick={() => (selectionKind === null ? onPick(effect) : onApply(effect.id))}
          >
            <EffectDemo effect={effect.id} />
            <b>{translatedOr(effectKey(effect.id), effect.label, val)}</b>
            <small>{translatedOr(effectKey(effect.id, 'Desc'), effect.description, val)}</small>
            <span className={styles.cardFor}>{val(text.edFor)} {kindsLabel(effect.kinds, val)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

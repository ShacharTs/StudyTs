import type { KeyboardEvent } from 'react';

/** Enter and Space activate an element that behaves like a button or link but is not a native one. */
export function onActivateKey(action: () => void) {
  return (e: KeyboardEvent) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    action();
  };
}

/** Props that make a whole tile a keyboard-reachable link; none while editing, so a keypress never navigates away. */
export function linkTileProps(editMode: boolean, onSelect: () => void) {
  return editMode ? {} : { role: 'link', tabIndex: 0, onKeyDown: onActivateKey(onSelect) };
}

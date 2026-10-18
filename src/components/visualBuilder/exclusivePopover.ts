import { useEffect } from 'react';

const OPEN_EVENT = 'visual-popover-open';

// Opening one builder pop-out closes the others, so colour and size never sit on screen together.
export function announcePopoverOpen(owner: object): void {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: owner }));
}

export function useClosesWhenAnotherOpens(owner: object, close: () => void): void {
  useEffect(() => {
    const onOpen = (event: Event) => {
      if ((event as CustomEvent<object>).detail !== owner) close();
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, [owner, close]);
}

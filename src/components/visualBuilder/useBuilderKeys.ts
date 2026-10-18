import { useEffect, useRef } from 'react';
import { commandForKey, type BuilderCommand, type KeyContext } from '@core/visualBuilder/keyboardMap';

const TYPING_TAGS = ['INPUT', 'TEXTAREA', 'SELECT'];

export const isTyping = (target: EventTarget | null): boolean => {
  const element = target as HTMLElement | null;
  return element !== null && (TYPING_TAGS.includes(element.tagName) || element.isContentEditable === true);
};

export function useBuilderKeys(context: KeyContext, onCommand: (command: BuilderCommand) => void, enabled = true): void {
  const latest = useRef({ context, onCommand });
  latest.current = { context, onCommand };

  useEffect(() => {
    if (!enabled) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      const input = { key: event.key, ctrl: event.ctrlKey || event.metaKey, shift: event.shiftKey, typing: isTyping(event.target) };
      const command = commandForKey(input, latest.current.context);
      if (!command) return;
      event.preventDefault();
      latest.current.onCommand(command);
    };
    const onBlur = () => latest.current.onCommand({ type: 'cancel' });
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('blur', onBlur);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('blur', onBlur);
    };
  }, [enabled]);
}

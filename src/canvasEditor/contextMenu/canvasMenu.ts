import { useCanvasStore, pasteClipboard, addObject } from '@canvasStore';
import { centerPage } from '../viewport/pageViewport';
import { spawnAtPoint } from '../interaction/drawTools';
import { AI_TEXT } from '@i18n';
import { describePage } from '@ai/context/selectionSummary';
import { requestAiPrompt } from '@ai/chat/aiPromptEvent';
import type { MenuAnchor, MenuEntry, MenuItem } from './contextMenuStore';

const STICKY_PROPS = { variant: 'sticky', text: 'Note' };

function selectAll(): void {
  const s = useCanvasStore.getState();
  const page = s.doc.pages.find((p) => p.id === s.currentPageId) ?? s.doc.pages[0];
  s.select(page ? [...page.objects] : []);
}

function zoomToFit(): void {
  const s = useCanvasStore.getState();
  const pageIndex = Math.max(0, s.doc.pages.findIndex((p) => p.id === s.currentPageId));
  centerPage(s.doc.pages, pageIndex);
}

/** Creates a text object at the click position, or on the current page when there is none. */
function addTextAt(label: string, anchor?: MenuAnchor, props?: Record<string, unknown>): MenuItem {
  return {
    label,
    run: () => {
      if (anchor) {
        spawnAtPoint(anchor.pageId, 'text', anchor.xMm, anchor.yMm, props);
        return;
      }
      useCanvasStore.getState().select([addObject('text', props ? { props } : {}).id]);
    },
  };
}

function addAndSelect(label: string, create: () => string): MenuItem {
  return { label, run: () => useCanvasStore.getState().select([create()]) };
}

function historyItems(): MenuEntry[] {
  const s = useCanvasStore.getState();
  return [
    { label: 'Undo', disabled: s.history.past.length === 0, run: () => useCanvasStore.getState().undo() },
    { label: 'Redo', disabled: s.history.future.length === 0, run: () => useCanvasStore.getState().redo() },
    null,
  ];
}

type Translate = (input?: unknown) => string;

/** One "Ask AI" entry with a pick-list of what to do to the page; picking opens the AI panel with a ready prompt (not sent). */
function askAiPageEntry(val: Translate): MenuItem {
  const ask = (label: unknown, prompt: unknown): MenuItem => ({
    label: val(label),
    run: () => requestAiPrompt(`${val(prompt)}

${describePage()}`),
  });
  return {
    label: val(AI_TEXT.askAi),
    submenu: [
      ask(AI_TEXT.askAiCustom, AI_TEXT.askAiCustomPrompt),
      ask(AI_TEXT.askAiTidy, AI_TEXT.askAiTidyPrompt),
      ask(AI_TEXT.quickFixPage, AI_TEXT.quickFixPagePrompt),
      ask(AI_TEXT.askAiExplainPage, AI_TEXT.askAiExplainPagePrompt),
    ],
  };
}

/** Actions for the empty canvas. */
export function buildCanvasMenu(val: Translate, anchor?: MenuAnchor): MenuEntry[] {
  return [
    askAiPageEntry(val),
    null,
    ...historyItems(),
    { label: 'Paste', run: pasteClipboard },
    null,
    addTextAt('Add Text Box', anchor),
    addTextAt('Add Sticky Note', anchor, STICKY_PROPS),
    addAndSelect('Add Shape', () => addObject('shape', { props: { shape: 'rect' } }).id),
    addAndSelect('Add State Node', () => addObject('node').id),
    addAndSelect('Add Formula', () => addObject('formula', { props: { latex: '\\text{formula}' } }).id),
    null,
    { label: 'Select All', run: selectAll },
    { label: 'Zoom to Fit', run: zoomToFit },
  ];
}

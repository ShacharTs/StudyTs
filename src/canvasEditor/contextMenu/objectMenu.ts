import {
  useCanvasStore,
  removeObjects,
  copySelection,
  cutSelection,
  duplicateSelection,
  bringForward,
  sendBackward,
  bringToFront,
  sendToBack,
  groupSelection,
  ungroupSelection,
  toggleLock,
  moveObjectsToPage,
  moveObjectsToNewPage,
} from '@canvasStore';
import { AI_TEXT, CANVAS_TEXT } from '@i18n';
import { describeSelection } from '@ai/context/selectionSummary';
import { requestAiPrompt } from '@ai/chat/aiPromptEvent';
import type { MenuEntry, MenuItem } from './contextMenuStore';

type Translate = (input?: unknown) => string;

/** One "Ask AI" entry with a pick-list of what to ask; picking opens the AI panel with a ready prompt about the selection (not sent). */
function askAiEntry(val: Translate): MenuItem {
  const ask = (label: unknown, prompt: unknown): MenuItem => ({
    label: val(label),
    run: () => requestAiPrompt(`${val(prompt)}

${describeSelection()}`),
  });
  return {
    label: val(AI_TEXT.askAi),
    submenu: [
      ask(AI_TEXT.askAiCustom, AI_TEXT.askAiCustomPrompt),
      ask(AI_TEXT.askAiExplain, AI_TEXT.askAiExplainPrompt),
      ask(AI_TEXT.askAiRewrite, AI_TEXT.askAiRewritePrompt),
      ask(AI_TEXT.askAiConvertTable, AI_TEXT.askAiConvertTablePrompt),
      ask(AI_TEXT.askAiConvertUml, AI_TEXT.askAiConvertUmlPrompt),
    ],
  };
}

/** "Move to page" with one entry per other page, plus a new page: the menu route to what dragging between pages does. */
function moveToPageEntry(ids: string[], val: Translate): MenuItem {
  const { doc, currentPageId } = useCanvasStore.getState();
  const pages: MenuItem[] = doc.pages.map((page, i) => ({
    label: val(CANVAS_TEXT.movePageLabel).replace('{n}', String(i + 1)),
    disabled: page.id === currentPageId,
    run: () => void moveObjectsToPage(ids, page.id, { kind: 'margin' }),
  }));
  return {
    label: val(CANVAS_TEXT.movePageTo),
    submenu: [...pages, { label: val(CANVAS_TEXT.moveToNewPage), run: () => void moveObjectsToNewPage(ids) }],
  };
}

/** Actions for the selected shapes / connectors. */
export function buildObjectMenu(val: Translate): MenuEntry[] {
  const s = useCanvasStore.getState();
  const ids = s.selectedIds;
  const grouped = ids.some((id) => !!s.doc.objects[id]?.groupId);
  const anyLocked = ids.some((id) => s.doc.objects[id]?.locked);

  return [
    { label: 'Cut', run: cutSelection },
    { label: 'Copy', run: copySelection },
    { label: 'Duplicate', run: duplicateSelection },
    { label: 'Delete', run: () => removeObjects([...ids]) },
    null,
    { label: 'Bring to Front', run: bringToFront },
    { label: 'Bring Forward', run: bringForward },
    { label: 'Send Backward', run: sendBackward },
    { label: 'Send to Back', run: sendToBack },
    null,
    { label: 'Group', disabled: ids.length < 2, run: groupSelection },
    { label: 'Ungroup', disabled: !grouped, run: ungroupSelection },
    { label: anyLocked ? 'Unlock' : 'Lock', run: toggleLock },
    moveToPageEntry([...ids], val),
    null,
    askAiEntry(val),
  ];
}

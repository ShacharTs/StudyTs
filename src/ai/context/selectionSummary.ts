import { useCanvasStore } from '@canvasStore';

const PREVIEW_CHARS = 300;

type Props = Record<string, unknown>;

const text = (value: unknown): string => (typeof value === 'string' ? value : '');

/** The words on an object, whatever its type keeps them in. */
function contentOf(type: string, props: Props): string {
  if (type === 'table' && Array.isArray(props.cells)) return (props.cells as unknown[][]).map((row) => row.join(' | ')).join(' / ');
  return text(props.text) || text(props.latex) || text(props.label) || text(props.className);
}

/** The selected canvas objects as text the AI can act on: the scene id, each block id, its type and its words. Empty when nothing is selected. */
export function describeSelection(): string {
  const { selectedIds, doc, sceneId } = useCanvasStore.getState();
  const lines = selectedIds
    .map((id) => doc.objects[id])
    .filter((obj) => Boolean(obj))
    .map((obj) => {
      const words = contentOf(obj.type, obj.props).slice(0, PREVIEW_CHARS);
      return `- block id "${obj.id}" (${obj.type})${words ? `: "${words}"` : ''}`;
    });
  if (lines.length === 0) return '';
  return `Scene id: "${sceneId ?? 'unknown'}"\nSelected on the open page:\n${lines.join('\n')}`;
}

/** The open page as text the AI can act on: scene id, page id and each block with its position and size. */
export function describePage(): string {
  const { doc, sceneId, currentPageId } = useCanvasStore.getState();
  const page = doc.pages.find((p) => p.id === currentPageId) ?? doc.pages[0];
  if (!page) return '';
  const lines = page.objects
    .map((id) => doc.objects[id])
    .filter((obj) => Boolean(obj))
    .map((obj) => `- block id "${obj.id}" (${obj.type}) at x=${Math.round(obj.x)}, y=${Math.round(obj.y)}, ${Math.round(obj.w)}x${Math.round(obj.h)}`);
  return `Scene id: "${sceneId ?? 'unknown'}"\nOpen page id: "${page.id}"\nBlocks on it:\n${lines.join('\n')}`;
}

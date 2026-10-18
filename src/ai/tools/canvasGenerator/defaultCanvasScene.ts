import type { CanvasScene, CanvasBlock, CanvasPage } from '@core/types/canvasScene';
import { normalizeUserText } from '@i18n/localizedValue';

export const A4_CANVAS_BOUNDS = { width: 794, height: 1123 };

export function buildDefaultCanvasScene(
  sceneId: string,
  title: string | Record<string, string | undefined>,
  engineType: string,
  customBlocks?: CanvasBlock[],
  customPages?: CanvasPage[]
): CanvasScene {
  const titleStr = typeof title === 'string' ? title : normalizeUserText(title);
  const normalizedId = sceneId.toLowerCase().replace(/[^a-z0-9-]/g, '-');

  if (customPages && customPages.length > 0) {
    const allBlocks = customPages.flatMap((p) => p.blocks);
    return {
      id: normalizedId,
      title: titleStr,
      canvasSize: A4_CANVAS_BOUNDS,
      pageSize: 'A4',
      pages: customPages,
      blocks: allBlocks.length > 0 ? allBlocks : (customBlocks ?? []),
    };
  }

  if (customBlocks && customBlocks.length > 0) {
    return {
      id: normalizedId,
      title: titleStr,
      canvasSize: A4_CANVAS_BOUNDS,
      pageSize: 'A4',
      blocks: customBlocks,
    };
  }

  const blocks: CanvasBlock[] = [
    {
      id: `${sceneId}-intro`,
      kind: 'richText',
      x: 20,
      y: 20,
      width: 560,
      height: 250,
      title: 'Introduction & Foundations',
      body: `Detailed overview for ${titleStr}. Data model and insights.`,
    },
    {
      id: `${sceneId}-proof`,
      kind: 'richText',
      variant: 'proof',
      x: 20,
      y: 290,
      width: 560,
      height: 250,
      title: 'Mathematical Analysis',
      body: `Process analysis and mathematical proof: $H = \\frac{m_{\\text{water}}}{m_{\\text{flour}}} \\times 100\\%$`,
    },
  ];

  if (engineType === 'graph') {
    blocks.push({
      id: `${sceneId}-graph`,
      kind: 'graph',
      x: 20,
      y: 560,
      width: 560,
      height: 480,
      title: 'Interactive Process Graph',
      state: {
        nodes: [
          { id: 'n1', label: 'Inputs', x: 120, y: 120, color: 'var(--accent-cyan)' },
          { id: 'n2', label: 'Processing (48h)', x: 380, y: 120, color: 'var(--accent-purple)' },
          { id: 'n3', label: 'Output Stage', x: 120, y: 320, color: '#f59e0b' },
          { id: 'n4', label: 'Final Result', x: 380, y: 320, color: '#10b981' },
        ],
        edges: [
          { id: 'e1', from: 'n1', to: 'n2', label: 'Initial Step', directed: true },
          { id: 'e2', from: 'n2', to: 'n3', label: 'Processing', directed: true },
          { id: 'e3', from: 'n3', to: 'n4', label: 'Finalizing', directed: true },
        ],
      },
    });
  }

  return {
    id: normalizedId,
    title: titleStr,
    canvasSize: A4_CANVAS_BOUNDS,
    pageSize: 'A4',
    blocks,
  };
}

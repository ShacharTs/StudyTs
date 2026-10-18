import type { CanvasBlock, CanvasPage, SceneOp, ManualSceneOp } from '@core/types/canvasScene';
import { validateBlocks } from '@core/validation/blocks';
import { buildDefaultCanvasScene, A4_CANVAS_BOUNDS } from './defaultCanvasScene';
import { SCENE_CHANGED_EVENT } from '@core/canvasBlocks/sceneChangedEvent';
import { normalizeSceneOps } from './normalizeSceneOps';
import { executeGenerateUmlDiagram } from '../umlDiagram/executeGenerateUmlDiagram';
import { clampSize, type BlockRect, resolveNonOverlappingPosition } from '../../../core/geometry/blockPlacement';

function clampAndDeoverlapBlocks(blocks: CanvasBlock[]): CanvasBlock[] {
  const placed: BlockRect[] = [];
  return blocks.map((block) => {
    const size = clampSize(block as BlockRect, A4_CANVAS_BOUNDS);
    const sized: BlockRect = { x: block.x, y: block.y, ...size };
    const pos = resolveNonOverlappingPosition(sized, A4_CANVAS_BOUNDS, placed);
    const rect: BlockRect = { ...sized, ...pos };
    placed.push(rect);
    return { ...block, ...size, ...pos };
  });
}

function checkDisallowedOps(ops: (SceneOp | ManualSceneOp)[]): string | null {
  for (const op of ops) {
    const opName = (op as { op?: string })?.op;
    if (opName === 'replaceScene' || opName === 'replaceBoxContent') {
      return `Operation "${opName}" is not permitted via AI tooling`;
    }
    if (opName === 'insertBlock') {
      const block = (op as { block?: unknown }).block;
      if (!block || typeof block !== 'object') {
        return `insertBlock needs a "block" object with id, kind, x, y, width, height plus the fields of its kind. ${CONVERT_EXAMPLE}`;
      }
      const valErr = validateBlocks([block as CanvasBlock]);
      if (valErr) {
        return `Invalid block structure: ${valErr}`;
      }
    }
  }
  return null;
}

const CONVERT_EXAMPLE =
  'To turn an existing block into another kind (text box to table) use one replaceBlock op: {"op":"replaceBlock","targetId":"<block id>","block":{"kind":"data","format":"table","columns":["A","B"],"rows":[["1","2"]]}} — it keeps the block position and size.';
const OPS_EXAMPLE = '{"sceneId":"<scene id>","ops":[{"op":"setField","targetId":"b1","fields":{"body":"new text"}}]}';

/** Models often send ops as a JSON string, a single op object, or under another key; accept those instead of failing. */
export function normalizeOps(args: Record<string, unknown>): (SceneOp | ManualSceneOp)[] {
  let raw: unknown = args.ops ?? args.operations ?? args.operation;
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (Array.isArray(raw)) return normalizeSceneOps(raw);
  if (raw && typeof raw === 'object' && 'op' in raw) return normalizeSceneOps([raw]);
  return [];
}

async function executeApplySceneOps(
  args: Record<string, unknown>,
  fetchFn: typeof fetch
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  const sceneId = args.sceneId as string;
  const ops = normalizeOps(args);

  if (!sceneId || typeof sceneId !== 'string') return { success: false, error: `sceneId must be a string. Expected call shape: ${OPS_EXAMPLE}` };
  if (ops.length === 0) {
    return {
      success: false,
      error: `ops must be a non-empty array of operations; you sent keys [${Object.keys(args).join(', ')}]. Expected call shape: ${OPS_EXAMPLE}. ${CONVERT_EXAMPLE} To build a whole new canvas use create_custom_canvas instead.`,
    };
  }

  const disallowedError = checkDisallowedOps(ops);
  if (disallowedError) return { success: false, error: disallowedError };

  try {
    const res = await fetchFn('/api/canvas-editor/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sceneId, ops }),
    });

    if (!res.ok) {
      const resJson = await res.json().catch(() => ({}));
      return { success: false, error: resJson.error || `Canvas write returned HTTP ${res.status}` };
    }

    const resData = await res.json();
    return {
      success: true,
      data: {
        message: `Successfully applied ${ops.length} operations to scene ${sceneId}`,
        version: resData.version,
        updatedAt: resData.updatedAt,
      },
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function sendCustomCanvasSave(scene: { id?: string; pages?: CanvasPage[]; blocks?: CanvasBlock[] }, fetchFn: typeof fetch): Promise<{ success: boolean; data?: unknown; error?: string }> {
  const ops: ManualSceneOp[] = [];

  if (Array.isArray(scene.pages) && scene.pages.length > 0) {
    scene.pages.forEach((page: CanvasPage, pIdx: number) => {
      if (pIdx > 0) {
        ops.push({ op: 'addPage', name: page.name, id: page.id });
      }
      page.blocks.forEach((block: CanvasBlock) => {
        ops.push({ op: 'insertBlock', block, pageId: page.id });
      });
    });
  } else if (Array.isArray(scene.blocks)) {
    scene.blocks.forEach((block: CanvasBlock) => {
      ops.push({ op: 'insertBlock', block });
    });
  }

  const res = await fetchFn('/api/canvas-editor/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sceneId: scene.id, ops, pages: scene.pages }),
  });

  if (!res.ok) {
    const resJson = await res.json().catch(() => ({}));
    return { success: false, error: resJson.error || `Canvas write returned HTTP ${res.status}` };
  }

  return {
    success: true,
    data: {
      message: `Saved ${scene.blocks?.length || 0} interactive canvas blocks to ${scene.id}/scene.ts on disk.`,
      scene,
    },
  };
}

/** Validates the supplied blocks/pages and clamps page blocks in place. Returns an error message, or null when fine. */
function prepareCustomCanvasInput(blocks: CanvasBlock[] | undefined, pages: CanvasPage[] | undefined): string | null {
  const blockError = blocks && blocks.length > 0 ? validateBlocks(blocks) : null;
  if (blockError) return `Invalid blocks: ${blockError}`;

  for (const page of pages ?? []) {
    if (!Array.isArray(page.blocks) || page.blocks.length === 0) continue;
    const pageError = validateBlocks(page.blocks);
    if (pageError) return `Invalid blocks on page ${page.name || page.id}: ${pageError}`;
    page.blocks = clampAndDeoverlapBlocks(page.blocks);
  }
  return null;
}

async function executeCreateCustomCanvas(
  args: Record<string, unknown>,
  fetchFn: typeof fetch
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  const sceneId = (args.sceneId as string) || `scene-${Date.now()}`;
  const title = (args.title as string | Record<string, string | undefined>) || 'New Scene';
  const engineType = (args.engineType as string) || 'multimodal';
  const customBlocks = args.blocks as CanvasBlock[] | undefined;
  const customPages = args.pages as CanvasPage[] | undefined;

  const inputError = prepareCustomCanvasInput(customBlocks, customPages);
  if (inputError) return { success: false, error: inputError };

  const clampedBlocks = customBlocks && customBlocks.length > 0 ? clampAndDeoverlapBlocks(customBlocks) : customBlocks;
  const scene = buildDefaultCanvasScene(sceneId, title, engineType, clampedBlocks, customPages);
  try {
    return await sendCustomCanvasSave(scene, fetchFn);
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

function announceSceneChange(sceneId: unknown): void {
  if (typeof window === 'undefined' || typeof sceneId !== 'string') return;
  window.dispatchEvent(new CustomEvent(SCENE_CHANGED_EVENT, { detail: { sceneId } }));
}

async function runCanvasTool(
  name: string,
  args: Record<string, unknown>,
  fetchFn: typeof fetch
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  if (name === 'generate_uml_diagram') return await executeGenerateUmlDiagram(args, fetchFn);
  if (name === 'apply_scene_ops') return await executeApplySceneOps(args, fetchFn);
  if (name === 'create_custom_canvas') return await executeCreateCustomCanvas(args, fetchFn);
  return { success: false, error: `Unknown tool: ${name}` };
}

export async function executeCanvasGeneratorTool(
  name: string,
  args: Record<string, unknown>,
  fetchFn: typeof fetch = fetch
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  const result = await runCanvasTool(name, args, fetchFn);
  if (result.success) announceSceneChange(args.sceneId);
  return result;
}

import { Router, Request, Response } from 'express';
import type { PrismaClient, Topic } from '@prisma/client';
import { commitScene } from '../utils/commitScene.js';
import { validateBlocks } from '../../src/core/validation/blocks/index.js';
import type { ManualSceneOp, SceneNode } from '../../src/core/types/canvasScene.js';
import { snapshotScene } from './sceneHistoryManager.js';
import { applySingleSceneOp, pruneDanglingConnectors, SceneMutationState } from './sceneOpsApplier.js';
import { route } from '../utils/routeHandler.js';
import { sceneIdWhere, topicOrIdWhere } from './topicCrud.js';
import { assetUploadRouter } from './assetUpload.js';

interface SceneSaveBody {
  ops?: unknown;
  nodes?: Record<string, SceneNode>;
  pages?: unknown;
  pageSize?: unknown;
  boundaryVisible?: unknown;
  margin?: unknown;
}

type SceneRecord = Record<string, unknown>;

export function resolvePagesForSave(
  opsRequested: boolean,
  reqBodyPages: unknown,
  scenePages: unknown
): Record<string, unknown>[] | undefined {
  if (!opsRequested && Array.isArray(reqBodyPages)) {
    return reqBodyPages as Record<string, unknown>[];
  }
  if (Array.isArray(scenePages)) {
    return scenePages.map((p: SceneRecord) => ({
      ...p,
      blocks: Array.isArray(p.blocks) ? (p.blocks as SceneRecord[]).map((b) => ({ ...b })) : [],
    }));
  }
  return undefined;
}

export function buildMutationState(scene: SceneRecord, reqBody: SceneSaveBody): SceneMutationState {
  const opsRequested = Array.isArray(reqBody.ops) && reqBody.ops.length > 0;
  return {
    blocks: ((scene.blocks as Record<string, unknown>[]) || []).map((b) => ({ ...b })),
    sceneNodes: { ...((scene.nodes as Record<string, SceneNode>) || {}), ...(reqBody.nodes || {}) },
    pages: resolvePagesForSave(opsRequested, reqBody.pages, scene.pages),
  };
}

export function applyOptionalSceneFields(
  scene: SceneRecord,
  reqBody: SceneSaveBody,
  mutationPages: Record<string, unknown>[] | undefined
): void {
  if (reqBody.pageSize !== undefined) scene.pageSize = reqBody.pageSize;
  if (reqBody.boundaryVisible !== undefined) scene.boundaryVisible = Boolean(reqBody.boundaryVisible);
  // Clamp defensively: the client already clamps the custom margin input to a
  // non-negative finite value (clampMarginMm in marginPresets.ts), but the
  // server is the actual trust boundary — a raw API call could send anything
  // (negative, NaN, a string, an object) into scene.margin otherwise.
  if (reqBody.margin !== undefined) {
    const margin = Number(reqBody.margin);
    scene.margin = Number.isFinite(margin) ? Math.max(0, margin) : 0;
  }
  if (mutationPages !== undefined || reqBody.pages !== undefined) {
    scene.pages = mutationPages ?? reqBody.pages;
  }
}

// Collects every block id already present anywhere in the incoming request
// (new blocks plus every block already saved in req.body.pages, which the
// UI's save request always includes — see scenes.ts's handleSaveScene
// comment on req.body.pages) so a connector's fromBlockId/toBlockId can be
// cross-referenced against the FULL incoming scene, not just whichever
// array it happens to arrive in. Without this, a connector between two
// already-saved blocks (the common case) always failed validation, since
// validateBlocks only ever saw the isolated addedBlocks/replaceBlocks array.
function collectAllIncomingBlockIds(req: Request): Set<string> {
  const blockLists: unknown[] = [req.body.replaceBlocks, req.body.addedBlocks];
  if (Array.isArray(req.body.pages)) blockLists.push(...req.body.pages.map((page: { blocks?: unknown } | null) => page?.blocks));
  const ids = new Set<string>();
  for (const list of blockLists) {
    if (!Array.isArray(list)) continue;
    for (const b of list) {
      const id = b && typeof b === 'object' ? (b as Record<string, unknown>).id : undefined;
      if (typeof id === 'string') ids.add(id);
    }
  }
  return ids;
}

/** First connector in `list` whose from/to block id is missing from the whole request, as an error message. */
function findConnectorAnchorError(list: unknown[], allIds: Set<string>): string | null {
  for (const [i, raw] of list.entries()) {
    const b = raw as Record<string, unknown>;
    if (b.kind !== 'connector') continue;
    for (const side of ['fromBlockId', 'toBlockId']) {
      if (!allIds.has(b[side] as string)) return `Invalid blocks: connector at index ${i} ("${b.id}"): ${side} "${b[side]}" does not match any block in this request`;
    }
  }
  return null;
}

/**
 * Validates the initial (pre-op) blocks on a scene-save request: each of
 * replaceBlocks/addedBlocks must be individually well-formed (validateBlocks'
 * own per-kind shape checks), and any connector among them must anchor to a
 * block id that exists SOMEWHERE in the full incoming request — new blocks
 * or blocks already saved in req.body.pages — not just within its own array.
 */
export function validateInitialBlocks(req: Request): string | null {
  if (typeof req.body?.sceneId !== 'string') return 'sceneId must be a string';
  const allIds = collectAllIncomingBlockIds(req);
  for (const list of [req.body.replaceBlocks, req.body.addedBlocks]) {
    if (!Array.isArray(list) || list.length === 0) continue;
    const err = validateBlocks(list, req.body.nodes);
    if (err) return `Invalid blocks: ${err}`;
    const anchorError = findConnectorAnchorError(list, allIds);
    if (anchorError) return anchorError;
  }
  return null;
}

function patchDeletes(blocks: Record<string, unknown>[], deletedIds?: string[]): Record<string, unknown>[] {
  if (!deletedIds || deletedIds.length === 0) return blocks;
  const deleteSet = new Set(deletedIds);
  return blocks
    .filter((b) => !deleteSet.has(b.id as string))
    .filter((b) => b.kind !== 'connector' || (!deleteSet.has(b.fromBlockId as string) && !deleteSet.has(b.toBlockId as string)));
}

function patchContent(blocks: Record<string, unknown>[], patches?: Array<{ id: string; fields?: Record<string, unknown> }>): void {
  if (!patches || patches.length === 0) return;
  for (const patch of patches) {
    const block = blocks.find((b) => b.id === patch.id);
    if (block && patch.fields) Object.assign(block, patch.fields);
  }
}

function patchGeometry(blocks: Record<string, unknown>[], patches?: Array<{ id: string; x: number; y: number; width: number; height: number }>): void {
  if (!patches || patches.length === 0) return;
  for (const patch of patches) {
    const block = blocks.find((b) => b.id === patch.id);
    if (block) Object.assign(block, { x: patch.x, y: patch.y, width: patch.width, height: patch.height });
  }
}

interface LegacyPatchBody {
  replaceBlocks?: Record<string, unknown>[];
  deletedIds?: string[];
  addedBlocks?: Record<string, unknown>[];
  contentPatches?: Parameters<typeof patchContent>[1];
  geometryPatches?: Parameters<typeof patchGeometry>[1];
}

function applyLegacyPatches(
  initialBlocks: Record<string, unknown>[],
  body: LegacyPatchBody
): Record<string, unknown>[] {
  const { replaceBlocks, deletedIds, addedBlocks, contentPatches, geometryPatches } = body;

  if (replaceBlocks && replaceBlocks.length > 0) return replaceBlocks;

  let blocks = patchDeletes(initialBlocks, deletedIds);
  if (addedBlocks && addedBlocks.length > 0) blocks = [...blocks, ...addedBlocks];
  patchContent(blocks, contentPatches);
  patchGeometry(blocks, geometryPatches);
  return blocks;
}

interface ConcurrencyMismatchResult {
  error: string;
  currentVersion?: number;
  expectedVersion?: number;
  currentUpdatedAt?: string | null;
  expectedUpdatedAt?: string;
}

function checkOptimisticConcurrency(
  scene: Record<string, unknown>,
  topic: { updatedAt?: Date | null },
  expectedVersion: number | undefined,
  expectedUpdatedAt: string | undefined
): ConcurrencyMismatchResult | null {
  if (expectedVersion !== undefined) {
    const currentVersion = typeof scene.version === 'number' ? scene.version : 0;
    if (currentVersion !== expectedVersion) {
      return {
        error: `Conflict: scene version mismatch. Expected version ${expectedVersion}, but server has version ${currentVersion}.`,
        currentVersion,
        expectedVersion,
      };
    }
  }

  if (expectedUpdatedAt !== undefined) {
    const currentUpdatedAt =
      (typeof scene.updatedAt === 'string' ? scene.updatedAt : topic.updatedAt?.toISOString()) ?? null;
    if (currentUpdatedAt && currentUpdatedAt !== expectedUpdatedAt) {
      return {
        error: `Conflict: scene timestamp mismatch. Expected updatedAt ${expectedUpdatedAt}, but server has ${currentUpdatedAt}.`,
        currentUpdatedAt,
        expectedUpdatedAt,
      };
    }
  }

  return null;
}

export const scenesRouter = Router();
const MAX_OPS = 1000;

scenesRouter.use(assetUploadRouter);

// validateInitialBlocks lives in ./sceneBlockValidation.ts — extracted there
// (rather than inlined here) to keep this file from growing past its
// existing 245-line size, following the same split-per-concern pattern
// already used for sceneConcurrency.ts/sceneHistoryManager.ts/
// sceneOpsApplier.ts/sceneLegacyPatches.ts.

function executeMutationOps(req: Request, mutationState: SceneMutationState): string | null {
  const { ops } = req.body;
  if (Array.isArray(ops) && ops.length > 0) {
    if (ops.length > MAX_OPS) {
      return `Too many scene operations in request (max ${MAX_OPS})`;
    }
    for (let i = 0; i < ops.length; i++) {
      const err = applySingleSceneOp(ops[i] as ManualSceneOp, mutationState);
      if (err) return `Op ${i}: ${err}`;
    }
    return null;
  }
  mutationState.blocks = applyLegacyPatches(mutationState.blocks, req.body);
  return null;
}

function prepareSceneObject(topic: Topic): Record<string, unknown> {
  const scene = (topic.scene as Record<string, unknown>) || {};
  if (!scene.canvasSize) scene.canvasSize = { width: 1200, height: 800 };
  return scene;
}

async function persistSceneMutation(
  prisma: PrismaClient,
  topic: Topic,
  scene: Record<string, unknown>,
  mutationState: SceneMutationState,
  req: Request,
  res: Response
): Promise<void> {
  await snapshotScene(prisma, topic);
  scene.version = (typeof scene.version === 'number' ? scene.version : 0) + 1;
  scene.updatedAt = new Date().toISOString();
  // scene.blocks is legacy/pre-pagination — once a scene has pages, the editor only
  // ever reads scene.pages[activePageIndex].blocks (useCanvasBlockState.ts's
  // currentPageBlocks), so continuing to write scene.blocks here from
  // mutationState.blocks (itself only patched by the no-ops legacy path, never by the
  // page-aware ops path) let it silently drift out of sync with scene.pages on every
  // save — extra/missing block ids that were invisible in the editor but corrupted the
  // saved data. Only single-page (no-pages-yet) scenes still need this field written.
  const hasPages = Array.isArray(mutationState.pages) && mutationState.pages.length > 0;
  if (!hasPages) scene.blocks = mutationState.blocks;
  scene.nodes = mutationState.sceneNodes;
  applyOptionalSceneFields(scene, req.body, mutationState.pages);

  await commitScene(prisma, topic, scene, 'ai-ops');
  res.json({ updatedIds: mutationState.blocks.map((b) => b.id), version: scene.version, updatedAt: scene.updatedAt, scene });
}

interface ConcurrencyBody {
  expectedVersion?: number;
  version?: number;
  expectedUpdatedAt?: string;
  updatedAt?: string;
}

interface SceneFetchResult {
  status: number;
  error?: string;
  conflict?: NonNullable<ReturnType<typeof checkOptimisticConcurrency>>;
  topic: Topic | null;
  scene: Record<string, unknown> | null;
}

async function fetchTopicAndScene(prisma: PrismaClient, sceneId: string, reqBody: ConcurrencyBody): Promise<SceneFetchResult> {
  const topic = await prisma.topic.findFirst({ where: sceneIdWhere(sceneId) });
  if (!topic) return { status: 404, error: `No topic found with scene id '${sceneId}'`, topic: null, scene: null };

  const scene = prepareSceneObject(topic);
  const conflict = checkOptimisticConcurrency(scene, topic, reqBody.expectedVersion ?? reqBody.version, reqBody.expectedUpdatedAt ?? reqBody.updatedAt);
  if (conflict) return { status: 409, conflict, topic: null, scene: null };

  return { status: 200, topic, scene };
}

async function handleSaveScene(req: Request, res: Response): Promise<void> {
  const prisma: PrismaClient = req.prisma;
  const initialError = validateInitialBlocks(req);
  if (initialError) return void res.status(400).json({ error: initialError });

  const sceneFetch = await fetchTopicAndScene(prisma, req.body.sceneId, req.body);
  if (sceneFetch.status !== 200) {
    if (sceneFetch.error) return void res.status(sceneFetch.status).json({ error: sceneFetch.error });
    if (sceneFetch.conflict) return void res.status(sceneFetch.status).json(sceneFetch.conflict);
    return;
  }

  const { topic, scene } = sceneFetch;
  if (!topic || !scene) return void res.status(500).json({ error: 'Internal server error' });

  // The UI save button (canvasHistoryApi.ts's saveCanvasChanges) sends no `ops` — it
  // computes the full updated pages client-side and sends them as req.body.pages.
  // executeMutationOps's no-ops fallback (applyLegacyPatches) only ever touches
  // mutationState.blocks, never .pages — so preferring the stale scene.pages here meant
  // the client's actual edited page content was silently discarded on every UI save for
  // any topic that already had pages: the response looked like a success (write did
  // happen, just to the wrong/old pages), but the edit never reached what the editor
  // reads back. Ops-based callers (the AI assistant) mutate mutationState.pages in place
  // via sceneOpsApplier.ts, so still start from the DB's current scene.pages, not the
  // (potentially absent) req.body.pages.
  const mutationState = buildMutationState(scene, req.body);

  const opErr = executeMutationOps(req, mutationState);
  if (opErr) return void res.status(400).json({ error: opErr });

  mutationState.blocks = pruneDanglingConnectors(mutationState.blocks);
  const validationError = validateBlocks(mutationState.blocks, mutationState.sceneNodes);
  if (validationError) return void res.status(400).json({ error: `Invalid scene state after operations: ${validationError}` });

  await persistSceneMutation(prisma, topic, scene, mutationState, req, res);
}

scenesRouter.post('/canvas-editor/save', route(handleSaveScene));

async function findTopicForTarget(prisma: PrismaClient, targetId: string) {
  return await prisma.topic.findFirst({ where: topicOrIdWhere(targetId) });
}

function formatSceneResult(topic: Topic, scene: Record<string, unknown>) {
  return {
    scene,
    topicId: topic.topicId,
    version: typeof scene.version === 'number' ? scene.version : 0,
    updatedAt: (typeof scene.updatedAt === 'string' ? scene.updatedAt : topic.updatedAt?.toISOString()) ?? null,
  };
}

async function handleGetScene(req: Request, res: Response): Promise<void> {
  const prisma: PrismaClient = req.prisma;
  const rawTarget = req.query.sceneId || req.query.topicId || req.query.path;
  if (typeof rawTarget !== 'string' || !rawTarget) {
    return void res.status(400).json({ error: 'sceneId, topicId, or path query parameter must be a string' });
  }

  const topic = await findTopicForTarget(prisma, rawTarget);
  if (!topic) return void res.status(404).json({ error: `No topic found with scene id '${rawTarget}'` });

  const scene = topic.scene as Record<string, unknown> | null;
  if (!scene || Object.keys(scene).length === 0) return void res.status(404).json({ error: `Topic '${rawTarget}' has no canvas scene data` });

  res.json(formatSceneResult(topic, scene));
}

scenesRouter.get('/canvas-editor/scene', route(handleGetScene));


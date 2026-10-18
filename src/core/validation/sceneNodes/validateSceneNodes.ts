import { isLocalizedValue } from '../blocks/validBlockKinds';

/**
 * Scene-node validation phase functions, orchestrated by
 * validateSceneNodes in sceneNodeValidators.ts.
 */

interface SceneNodeContext {
  nodeMap: Record<string, unknown>;
  nodeIds: Set<string>;
  blockMap: Map<string, Record<string, unknown>>;
  blocks: unknown[] | undefined;
}

function buildBlockMap(blocks: unknown[] | undefined): Map<string, Record<string, unknown>> {
  const blockMap = new Map<string, Record<string, unknown>>();
  if (Array.isArray(blocks)) {
    for (const raw of blocks) {
      if (raw && typeof raw === 'object' && typeof (raw as Record<string, unknown>).id === 'string') {
        const b = raw as Record<string, unknown>;
        blockMap.set(b.id as string, b);
      }
    }
  }
  return blockMap;
}

function validateTextNode(id: string, n: Record<string, unknown>): string | null {
  if (!isLocalizedValue(n.body)) {
    return `Node "${id}" (text): requires "body" as string or { he, en }`;
  }
  return null;
}

function validateBlockRefNode(id: string, n: Record<string, unknown>, ctx: SceneNodeContext): string | null {
  if (typeof n.blockId !== 'string') {
    return `Node "${id}" (blockRef): requires string "blockId"`;
  }
  if (n.blockId === id) {
    return `Node "${id}" (blockRef): cannot reference itself`;
  }
  const targetExists = ctx.blockMap.has(n.blockId) || ctx.nodeIds.has(n.blockId);
  if (ctx.blocks && !targetExists) {
    return `Node "${id}" (blockRef): blockId "${n.blockId}" does not match any block or node in this scene`;
  }
  return null;
}

function validateBoxNode(id: string, n: Record<string, unknown>, ctx: SceneNodeContext): string | null {
  if (!Array.isArray(n.childIds) || !n.childIds.every((cid) => typeof cid === 'string')) {
    return `Node "${id}" (box): requires "childIds" as string[]`;
  }
  for (const cid of n.childIds) {
    if (!ctx.nodeIds.has(cid) && !ctx.blockMap.has(cid)) {
      return `Node "${id}" (box): childId "${cid}" does not exist in scene.nodes`;
    }
    if (cid === id) {
      return `Node "${id}" (box): cannot contain itself as a child`;
    }
  }
  return null;
}

function validateOneNode(id: string, rawNode: unknown, ctx: SceneNodeContext): string | null {
  if (!rawNode || typeof rawNode !== 'object') {
    return `Node "${id}" is not an object`;
  }
  const n = rawNode as Record<string, unknown>;
  if (typeof n.id !== 'string') {
    return `Node "${id}" is missing a string "id"`;
  }
  if (n.id !== id) {
    return `Node key "${id}" does not match node.id "${n.id}"`;
  }
  if (n.kind !== 'text' && n.kind !== 'blockRef' && n.kind !== 'box') {
    return `Node "${id}" has invalid kind "${n.kind}". Valid node kinds: text, blockRef, box`;
  }

  if (n.kind === 'text') return validateTextNode(id, n);
  if (n.kind === 'blockRef') return validateBlockRefNode(id, n, ctx);
  return validateBoxNode(id, n, ctx);
}

function validateNodeStructure(ctx: SceneNodeContext): string | null {
  for (const [id, rawNode] of Object.entries(ctx.nodeMap)) {
    const error = validateOneNode(id, rawNode, ctx);
    if (error) return error;
  }
  return null;
}

function makeGetChildren(ctx: SceneNodeContext): (containerId: string) => string[] {
  return (containerId: string): string[] => {
    const fromBlock = ctx.blockMap.get(containerId);
    if (fromBlock && fromBlock.kind === 'box' && Array.isArray(fromBlock.childIds)) {
      return fromBlock.childIds;
    }
    const fromNode = ctx.nodeMap[containerId] as Record<string, unknown> | undefined;
    if (fromNode && fromNode.kind === 'box' && Array.isArray(fromNode.childIds)) {
      return fromNode.childIds;
    }
    return [];
  };
}

function checkBoxCycles(ctx: SceneNodeContext, getChildren: (id: string) => string[]): string | null {
  const checkCycle = (currentId: string, visitedPath: string[]): string | null => {
    if (visitedPath.includes(currentId)) {
      return `Circular reference detected in box nesting: ${[...visitedPath, currentId].join(' -> ')}`;
    }
    const children = getChildren(currentId);
    for (const childId of children) {
      const err = checkCycle(childId, [...visitedPath, currentId]);
      if (err) return err;
    }
    return null;
  };

  for (const [bId, b] of ctx.blockMap.entries()) {
    if (b.kind === 'box') {
      const err = checkCycle(bId, []);
      if (err) return err;
    }
  }
  for (const [nId, rawNode] of Object.entries(ctx.nodeMap)) {
    const n = rawNode as Record<string, unknown>;
    if (n.kind === 'box') {
      const err = checkCycle(nId, []);
      if (err) return err;
    }
  }
  return null;
}

function checkBlockRefAncestorCycles(
  ctx: SceneNodeContext,
  getChildren: (id: string) => string[]
): string | null {
  const checkContains = (ancestorId: string, targetId: string): boolean => {
    const children = getChildren(ancestorId);
    if (children.includes(targetId)) return true;
    return children.some((cid) => checkContains(cid, targetId));
  };

  for (const [nId, rawNode] of Object.entries(ctx.nodeMap)) {
    const n = rawNode as Record<string, unknown>;
    if (n.kind === 'blockRef' && typeof n.blockId === 'string') {
      if (checkContains(n.blockId, nId)) {
        return `Circular reference: blockRef "${nId}" references ancestor box "${n.blockId}"`;
      }
    }
  }
  return null;
}

function markReachableFromBoxBlocks(
  blocks: unknown[],
  markReachable: (id: string) => void
): boolean {
  const boxes = blocks.filter((raw): raw is Record<string, unknown> => (
    !!raw && typeof raw === 'object' && (raw as Record<string, unknown>).kind === 'box'
  ));
  for (const box of boxes) {
    if (!Array.isArray(box.childIds)) continue;
    for (const cid of box.childIds) markReachable(cid as string);
  }
  return boxes.length > 0;
}

function checkReachability(
  ctx: SceneNodeContext,
  getChildren: (id: string) => string[]
): string | null {
  if (!Array.isArray(ctx.blocks) || ctx.nodeIds.size === 0) return null;

  const reachable = new Set<string>();
  const markReachable = (id: string) => {
    if (reachable.has(id)) return;
    reachable.add(id);
    for (const cid of getChildren(id)) {
      markReachable(cid);
    }
  };

  const hasBoxBlocks = markReachableFromBoxBlocks(ctx.blocks, markReachable);
  if (!hasBoxBlocks) return null;

  for (const nid of ctx.nodeIds) {
    if (!reachable.has(nid)) {
      return `Unreachable orphan node "${nid}" in scene.nodes`;
    }
  }
  return null;
}

/**
 * Scene-node graph validation: structure, box-nesting cycle detection,
 * blockRef ancestor-cycle detection, and orphan-node reachability.
 * Split out of canvasValidators.ts (see that file for the shared entry point).
 */

export function validateSceneNodes(nodes: unknown, blocks?: unknown[]): string | null {
  if (nodes === undefined || nodes === null) return null;
  if (typeof nodes !== 'object' || Array.isArray(nodes)) {
    return 'Scene nodes must be an object map';
  }

  const nodeMap = nodes as Record<string, unknown>;
  const ctx: SceneNodeContext = {
    nodeMap,
    nodeIds: new Set(Object.keys(nodeMap)),
    blockMap: buildBlockMap(blocks),
    blocks,
  };

  const structureError = validateNodeStructure(ctx);
  if (structureError) return structureError;

  const getChildren = makeGetChildren(ctx);

  const boxCycleError = checkBoxCycles(ctx, getChildren);
  if (boxCycleError) return boxCycleError;

  const blockRefCycleError = checkBlockRefAncestorCycles(ctx, getChildren);
  if (blockRefCycleError) return blockRefCycleError;

  return checkReachability(ctx, getChildren);
}

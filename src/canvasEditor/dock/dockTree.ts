import type { DockNode, DockSplit, DockStack, SplitAxis } from './dockTypes';

export function createStack(panelId: string): DockStack {
  return {
    type: 'stack',
    id: `stack-${crypto.randomUUID()}`,
    panelIds: [panelId],
    activeId: panelId,
    collapsed: false,
  };
}

export function findStack(node: DockNode, stackId: string): DockStack | null {
  if (node.type === 'stack') return node.id === stackId ? node : null;
  for (const child of node.children) {
    const found = findStack(child, stackId);
    if (found) return found;
  }
  return null;
}

export function findPanelInTree(node: DockNode, panelId: string): DockStack | null {
  if (node.type === 'stack') return node.panelIds.includes(panelId) ? node : null;
  for (const child of node.children) {
    const found = findPanelInTree(child, panelId);
    if (found) return found;
  }
  return null;
}

export function updateStack(
  node: DockNode,
  stackId: string,
  updater: (s: DockStack) => DockStack
): DockNode {
  if (node.type === 'stack') return node.id === stackId ? updater(node) : node;
  return {
    ...node,
    children: node.children.map((c) => updateStack(c, stackId, updater)),
  };
}

export function resizeChild(
  node: DockNode,
  splitId: string,
  index: number,
  sizePx: number
): DockNode {
  if (node.type === 'stack') return node;
  if (node.id === splitId) {
    const sizes = [...node.sizes];
    sizes[index] = sizePx;
    return { ...node, sizes };
  }
  return {
    ...node,
    children: node.children.map((c) => resizeChild(c, splitId, index, sizePx)),
  };
}

export function removePanel(node: DockNode, panelId: string, stackId: string): DockNode | null {
  if (node.type === 'stack') {
    if (node.id !== stackId) return node;
    const panelIds = node.panelIds.filter((id) => id !== panelId);
    if (panelIds.length === 0) return null;
    const activeId = node.activeId === panelId ? panelIds[panelIds.length - 1] : node.activeId;
    return { ...node, panelIds, activeId };
  }
  const children: DockNode[] = [];
  const sizes: (number | undefined)[] = [];
  node.children.forEach((child, i) => {
    const next = removePanel(child, panelId, stackId);
    if (next) {
      children.push(next);
      sizes.push(node.sizes[i]);
    }
  });
  if (children.length === 0) return null;
  if (children.length === 1) return children[0];
  return { ...node, children, sizes };
}

function wrap(
  target: DockNode,
  newNode: DockNode,
  side: 'before' | 'after',
  axis: SplitAxis
): DockSplit {
  const children = side === 'before' ? [newNode, target] : [target, newNode];
  return {
    type: axis,
    id: `split-${crypto.randomUUID()}`,
    children,
    sizes: [undefined, undefined],
  };
}

export function insertBeside(
  node: DockNode,
  targetStackId: string,
  newNode: DockNode,
  side: 'before' | 'after',
  axis: SplitAxis
): DockNode {
  if (node.type === 'stack') {
    return node.id === targetStackId ? wrap(node, newNode, side, axis) : node;
  }
  const idx = node.children.findIndex((c) => c.type === 'stack' && c.id === targetStackId);
  if (idx === -1) {
    return {
      ...node,
      children: node.children.map((c) => insertBeside(c, targetStackId, newNode, side, axis)),
    };
  }
  if (node.type === axis) {
    const at = side === 'before' ? idx : idx + 1;
    return {
      ...node,
      children: [...node.children.slice(0, at), newNode, ...node.children.slice(at)],
      sizes: [...node.sizes.slice(0, at), undefined, ...node.sizes.slice(at)],
    };
  }
  const children = [...node.children];
  children[idx] = wrap(children[idx], newNode, side, axis);
  return { ...node, children };
}

export function insertAtRoot(
  root: DockNode,
  newNode: DockNode,
  side: 'before' | 'after',
  axis: SplitAxis
): DockNode {
  if (root.type === axis) {
    return side === 'before'
      ? { ...root, children: [newNode, ...root.children], sizes: [undefined, ...root.sizes] }
      : { ...root, children: [...root.children, newNode], sizes: [...root.sizes, undefined] };
  }
  return wrap(root, newNode, side, axis);
}

export function mergeIntoStack(
  node: DockNode,
  panelId: string,
  targetStackId: string
): DockNode {
  if (node.type === 'stack') {
    if (node.id !== targetStackId) return node;
    return { ...node, panelIds: [...node.panelIds, panelId], activeId: panelId };
  }
  return {
    ...node,
    children: node.children.map((c) => mergeIntoStack(c, panelId, targetStackId)),
  };
}

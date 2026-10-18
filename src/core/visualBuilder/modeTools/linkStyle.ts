import type { VisualSpec } from '../../types/visualSpec';
import type { WorkspaceMode } from '../modes/workspaceMode';

// The mode's connect tool names the arrow it draws; `both` and `undirected` are drawn without a head.
export function connectArrowOf(mode: WorkspaceMode): boolean {
  const connect = mode.tools.find((tool) => tool.id === 'connect');
  return !(connect && connect.id === 'connect') || connect.arrow === 'directed';
}

// A drawing keeps one look: when every link already agrees, a new link copies it, otherwise the mode's arrow is used.
export function newLinkArrow(spec: VisualSpec, configured: boolean): boolean {
  const looks = spec.elements.flatMap((el) => (el.builder?.link ? [el.builder.link.arrow] : []));
  return looks.length > 0 && looks.every((arrow) => arrow === looks[0]) ? looks[0] : configured;
}

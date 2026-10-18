import type { VisualSpec } from '../../../types/visualSpec';
import { isOwner } from '../../builderEdits';
import { shapeText } from '../../modeTools/shapeText';

export interface GraphVertex {
  id: string;
  label: string;
}

export interface GraphModelEdge {
  id: string;
  from: string;
  to: string;
  weight: number;
}

export interface Neighbour {
  vertex: string;
  edge: string;
  weight: number;
}

export interface GraphModel {
  vertices: GraphVertex[];
  edges: GraphModelEdge[];
  directed: boolean;
  weighted: boolean;
  neighbours: (vertex: string) => Neighbour[];
  labelOf: (vertex: string) => string;
}

const VERTEX_KINDS = ['circle', 'ellipse'];
const VERTEX_PACKS = ['automata/state', 'automata/accepting-state'];

// A vertex is a round shape or an automaton state; captions, tape cells and other objects are ignored, never guessed.
const isOverlay = (el: VisualSpec['elements'][number]): boolean => el.builder?.fx === true || el.builder?.say === true;
const isRoundVertex = (el: VisualSpec['elements'][number]): boolean => isOwner(el) && !isOverlay(el) && (VERTEX_KINDS.includes(el.kind) || VERTEX_PACKS.includes(el.builder?.pack ?? ''));

// What counts as a vertex is the caller's binding: round shapes and automaton states by default, devices for a network.
export type VertexTest = (el: VisualSpec['elements'][number]) => boolean;

const weightOf = (spec: VisualSpec, linkId: string): number | null => {
  const text = (spec.elements.find((el) => el.id === `${linkId}-label`)?.content ?? '').replace(/[$\\]/g, '').trim();
  const value = Number(text.includes('/') ? text.split('/').pop() : text);
  return text !== '' && Number.isFinite(value) ? value : null;
};

// Reads the drawing as a graph: directed when every link has an arrow head, weighted when a link carries a number.
export function readGraph(spec: VisualSpec, isVertex: VertexTest = isRoundVertex): GraphModel {
  const vertices = spec.elements.filter(isVertex).map((el) => ({ id: el.id, label: shapeText(spec, el) || el.id }));
  const known = new Set(vertices.map((vertex) => vertex.id));
  const links = spec.elements.filter((el) => el.builder?.link && known.has(el.builder.link.from) && known.has(el.builder.link.to));
  const edges = links.map((el) => ({ id: el.id, from: el.builder!.link!.from, to: el.builder!.link!.to, weight: weightOf(spec, el.id) ?? 1 }));
  const directed = links.length > 0 && links.every((el) => el.builder!.link!.arrow);
  const weighted = links.some((el) => weightOf(spec, el.id) !== null);
  const labels = new Map(vertices.map((vertex) => [vertex.id, vertex.label]));
  const labelOf = (vertex: string): string => labels.get(vertex) ?? vertex;
  const neighbours = (vertex: string): Neighbour[] =>
    edges
      .flatMap((edge) => {
        const out = edge.from === vertex ? [{ vertex: edge.to, edge: edge.id, weight: edge.weight }] : [];
        const back = !directed && edge.to === vertex && edge.from !== vertex ? [{ vertex: edge.from, edge: edge.id, weight: edge.weight }] : [];
        return [...out, ...back];
      })
      .sort((a, b) => labelOf(a.vertex).localeCompare(labelOf(b.vertex)) || a.edge.localeCompare(b.edge));
  return { vertices, edges, directed, weighted, neighbours, labelOf };
}

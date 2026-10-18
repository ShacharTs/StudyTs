// What a search did, in order. Vertex and edge values are element ids of the drawing.
export type GraphEvent =
  | { type: 'start'; vertex: string }
  | { type: 'discover'; vertex: string; via: string; edge: string; frontier: string[] }
  | { type: 'visit'; vertex: string; order: number; frontier: string[]; via: string | null; edge: string | null }
  | { type: 'relax'; edge: string; from: string; to: string; distance: number; improved: boolean };

export type GraphTrace = GraphEvent[];

// A flow run: each augmenting path, then the cut that proves the flow is maximal. Edge values are element ids of the drawing.
export type FlowEvent =
  | { type: 'augment'; vertices: string[]; edges: string[]; pushed: number; total: number; flows: Record<string, number> }
  | { type: 'cut'; sourceSide: string[]; edges: string[]; value: number };

export type FlowTrace = FlowEvent[];

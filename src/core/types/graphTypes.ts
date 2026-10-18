/**
 * Segregated interfaces for Graph nodes, edges, geometry, and runtime visual states.
 * Implements Interface Segregation Principle for graph visualization data structures.
 */

import type { LocalizedValue } from '../../i18n/localizedValue';
import type { NetworkDevice } from '../canvasBlocks/networkDevices';

export interface GraphNodeIdentity {
  id: string;
  label?: string;
}

export interface GraphNodeGeometry {
  x?: number;
  y?: number;
  xPct?: number;
  yPct?: number;
  radius?: number;
  width?: number;
  height?: number;
  shape?: 'circle' | 'rectangle' | 'diamond' | 'pill'; // UML node shapes
  labelLines?: string[]; // multi-line label (name / attrs / methods for UML)
  compartmentLabels?: [string, string, string]; // UML: name | attrs | methods
  stereotype?: string; // UML stereotype text, e.g. "interface", rendered as <<interface>>
  /** Draws the node as this network device icon instead of a circle/box. */
  device?: NetworkDevice;
}

export interface GraphNodeVisualState {
  color?: string;
  strokeColor?: string;
  faded?: boolean;
  hidden?: boolean;
  glow?: boolean;
  isAccept?: boolean;
  isInitial?: boolean;
  isCurrent?: boolean;
}

export interface GraphNode extends GraphNodeIdentity, GraphNodeGeometry, GraphNodeVisualState {}

export interface GraphEdgeIdentity {
  id: string;
  from: string;
  to: string;
  label?: string;
}

export interface GraphEdgeGeometry {
  bend?: number;
  directed?: boolean;
  labelPosition?: 'start' | 'middle' | 'end' | string;
  labelOffset?: 'above' | 'below' | 'left' | 'right' | string;
}

export interface GraphEdgeVisualState {
  color?: string;
  dashed?: boolean;
  faded?: boolean;
  hidden?: boolean;
  glow?: boolean;
  width?: number;
  style?: 'solid' | 'dashed' | string;
  edgeStyle?: 'extends' | 'implements' | 'association' | 'composition' | 'aggregation' | 'dependency' | 'realization' | string; // UML arrowhead variants
  isFluid?: boolean;
  flowSpeed?: number;
}

export interface GraphEdge extends GraphEdgeIdentity, GraphEdgeGeometry, GraphEdgeVisualState {}

export interface GraphCallout {
  id?: string;
  anchorId?: string;
  x?: number;
  y?: number;
  xPct?: number;
  yPct?: number;
  text: LocalizedValue;
  tone?: 'info' | 'success' | 'warn' | 'fail' | string;
}

/** A labelled frame (LAN, DMZ, Internet…) drawn behind the nodes it groups; x/y/width/height are block px. */
export interface GraphZone {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GraphState {
  nodes: GraphNode[];
  edges: GraphEdge[];
  zones?: GraphZone[];
  callouts?: GraphCallout[];
}

export interface GraphExecutionState {
  graph?: GraphState;
}

export type NodeRole =
  | 'idle'
  | 'source'
  | 'target'
  | 'unvisited'
  | 'visited'
  | 'current'
  | 'frontier'
  | 'settled'
  | 'processed'
  | 'rejected'
  | 'classA'
  | 'classB'
  | 'gadget'
  | 'clause'
  | 'variable'
  | (string & Record<never, never>);

export type EdgeRole =
  | 'idle'
  | 'active'
  | 'tree'
  | 'back'
  | 'forward'
  | 'cross'
  | 'rejected'
  | 'dim'
  | 'gadget'
  | 'solution'
  | (string & Record<never, never>);


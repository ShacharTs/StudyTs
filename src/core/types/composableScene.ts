/**
 * Pure Declarative Specification & Event Types for the Generic Composable Algorithm Engine.
 * Relocated to @core/types/composableScene as part of Phase 18b to ensure pure core layering.
 * All interfaces are Plain Old JavaScript Objects (POJOs) for serializable visualization steps.
 */

import type { LocalizedValue } from '../../i18n/localizedValue';
import type { NetworkDevice } from '../canvasBlocks/networkDevices';

/**
 * Element kinds an event can address in declarative timeline steps.
 */
export type PrimitiveElementType = 'node' | 'edge' | 'clause' | 'stage';

export interface PrimitiveTarget {
  primitiveId: string;
  elementId?: string;
  elementType?: PrimitiveElementType;
  property?: string;
}

/**
 * Closed set of timeline animation actions.
 */
export type VisualizationAction =
  | 'highlight'
  | 'change-color'
  | 'fade'
  | 'traverse-edge'
  | 'activate-stage';

export interface VisualizationEvent {
  id?: string;
  action: VisualizationAction;
  target: PrimitiveTarget;
  value?: unknown;
}

export interface AlgorithmStateDisplay {
  currentVertex?: string;
  queue?: string[];
  stack?: string[];
  visited?: string[];
  distances?: Record<string, number>;
  colorMap?: Record<string, string>;
  reductionStage?: number;
  activeClause?: string;
  cliqueSize?: number;
  note?: string | LocalizedValue;
}

export interface Explanation {
  title: string | LocalizedValue;
  text: string | LocalizedValue;
  why?: string | LocalizedValue;
  next?: string | LocalizedValue;
  concept?: string | LocalizedValue;
  algorithmState?: AlgorithmStateDisplay;
}

export interface VisualizationStep {
  id: string;
  events: VisualizationEvent[];
  explanation?: Explanation;
  headerTitle?: string | LocalizedValue;
  footerText?: string | LocalizedValue;
}

export interface GraphNodeSpec {
  id: string;
  x: number;
  y: number;
  label?: string;
  color?: string;
  strokeColor?: string;
  faded?: boolean;
  glow?: boolean;
  active?: boolean;
  isAccept?: boolean;
  isInitial?: boolean;
  radius?: number;
  shape?: 'circle' | 'rectangle' | 'diamond' | 'pill';
  width?: number;
  height?: number;
  labelLines?: string[];
  compartmentLabels?: [string, string, string];
  stereotype?: string;
  device?: NetworkDevice;
}

export interface GraphEdgeSpec {
  id: string;
  from: string;
  to: string;
  label?: string;
  color?: string;
  strokeWidth?: number;
  dashed?: boolean;
  faded?: boolean;
  directed?: boolean;
  isFluid?: boolean;
  flowSpeed?: number;
  edgeStyle?: 'extends' | 'implements' | 'association' | 'composition' | 'aggregation' | 'dependency' | 'realization' | string;
  /** Perpendicular offset (px) of the edge's curve control point from its
   * straight-line midpoint; 0/undefined draws a straight line. Signed so
   * parallel edges between the same pair of nodes can bow to opposite
   * sides. Self-loops (from === to) use it as the loop's spread instead. */
  bend?: number;
}

/** Semantic tone of an annotation, mapped to a colour by the renderer. */
export type CalloutTone = 'info' | 'success' | 'warn' | 'fail';

/**
 * A floating annotation attached to a graph node or coordinates.
 */
export interface GraphCalloutSpec {
  id: string;
  text: string | LocalizedValue;
  tone?: CalloutTone;
  anchorId?: string;
  x?: number;
  y?: number;
}

export interface GraphPrimitiveSpec {
  id: string;
  type: 'graph';
  nodes: GraphNodeSpec[];
  edges: GraphEdgeSpec[];
  callouts?: GraphCalloutSpec[];
}

export interface PipelineStageSpec {
  id: number;
  title: string | LocalizedValue;
  latexStr: string;
  detailStr?: string | LocalizedValue;
  active?: boolean;
}

export interface PipelineStreamPrimitiveSpec {
  id: string;
  type: 'pipeline';
  activeStage: number;
  inputStr: string;
  inputDetail?: string | LocalizedValue;
  reductionName: string;
  reductionDetail?: string | LocalizedValue;
  outputStr: string;
  outputDetail?: string | LocalizedValue;
  stages?: PipelineStageSpec[];
}

export interface SatLiteralSpec {
  id: string;
  name: string;
  negated?: boolean;
  value?: boolean | null;
  highlighted?: boolean;
}

export interface SatClauseSpec {
  id: string;
  literals: SatLiteralSpec[];
  active?: boolean;
  satisfied?: boolean;
}

export interface SatFormulaPrimitiveSpec {
  id: string;
  type: 'sat';
  formulaLatex?: string;
  clauses: SatClauseSpec[];
}

export type PrimitiveSpec = GraphPrimitiveSpec | PipelineStreamPrimitiveSpec | SatFormulaPrimitiveSpec;

/** Layouts supported by composable scene renderers. */
export type SceneLayoutMode = 'single' | 'split_horizontal' | 'split_vertical';

export interface ComposableScene {
  id: string;
  title?: string | LocalizedValue;
  layoutMode: SceneLayoutMode;
  primitives: PrimitiveSpec[];
}

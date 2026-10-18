/**
 * Base data structures and visual state definitions for the platform.
 * Composes segregated domain interfaces for step narration, graphs, and domain execution states.
 * All types strictly adhere to Pure TypeScript "Code-as-Data".
 */

export * from './graphTypes';

import type { GraphExecutionState, GraphState } from './graphTypes';
import type { LocalizedValue } from '../../i18n/localizedValue';
import type { ComposableScene, VisualizationStep } from './composableScene';

/**
 * Segregated interfaces for step narration, concepts, and explanations.
 * Isolates user-facing step narration from internal algorithm execution state.
 */


export interface VizStepNarration {
  title?: string | LocalizedValue;
  whatChanged: string | LocalizedValue;
  why: string | LocalizedValue;
  concept?: string | LocalizedValue;
}

export type StepNarration = VizStepNarration;

export interface VizStep<S> extends VizStepNarration {
  state: S;
}

/**
 * Segregated domain execution state interfaces for algorithm simulations.
 * Decouples individual algorithm execution contexts (Turing, LP, Pipeline, ClassDiagram).
 */


export interface TuringTapeCell {
  char?: string;
  symbol?: string;
  index?: number;
  state?: string;
  highlighted?: boolean;
}

export interface TuringMachineState {
  tape: (string | TuringTapeCell)[];
  headPosition: number;
  currentState: string;
  status: 'running' | 'accepted' | 'rejected' | 'looping';
  stepCount: number;
  cellWidth?: number;
}

export interface TuringExecutionState {
  turingMachine?: TuringMachineState;
}

export interface LpConstraint {
  a: number;
  b: number;
  c: number;
  label?: string;
  active?: boolean;
}

export interface LpPoint {
  x: number;
  y: number;
  label?: string;
  isBfs?: boolean;
  isOptimal?: boolean;
}

export interface LpObjective {
  a: number;
  b: number;
  label?: string;
  targetValue?: number;
}

export interface LpMatrixEquation {
  objective?: string | LpObjective;
  lines?: string[];
  highlightIndex?: number;
  note?: LocalizedValue;
  noteTone?: string;
}

export interface LpDualityCardData {
  primalValue?: string | number;
  dualValue?: string | number;
  gap?: string | number;
}

export interface LpState {
  domain?: { x: [number, number]; y: [number, number] };
  constraints?: LpConstraint[];
  points?: LpPoint[];
  polygon?: { x: number; y: number }[];
  objective?: LpObjective;
  matrixEquation?: LpMatrixEquation;
  dualityCard?: LpDualityCardData;
  lines?: string[];
  highlightIndex?: number;
  note?: LocalizedValue;
  noteTone?: string;
  lp?: LpState;
}

export interface LinearProgrammingExecutionState {
  lp?: LpState;
  constraints?: LpConstraint[];
  points?: LpPoint[];
  lines?: string[];
  objective?: LpObjective;
  dualityCard?: LpDualityCardData;
  matrixEquation?: LpMatrixEquation;
}

export interface PipelineState {
  inputStr?: string;
  inputDetail?: LocalizedValue;
  reductionName?: string;
  reductionDetail?: LocalizedValue;
  outputStr?: string;
  deciderName?: string;
  deciderDetail?: LocalizedValue;
  activeStage?: number;
  decisionResult?: 'accept' | 'reject';
  graph?: GraphState;
  pipeline?: PipelineState;
}

export interface PipelineExecutionState {
  pipeline?: PipelineState;
}

export interface ClassDiagramExecutionState {
  classDiagram?: { activeClass: string };
}

export interface ComposableExecutionState {
  composableScene?: ComposableScene;
  steps?: VisualizationStep[];
}

/**
 * Composite algorithm execution state composed from bounded domain execution interfaces.
 */
export interface VisualizationState
  extends TuringExecutionState,
    GraphExecutionState,
    LinearProgrammingExecutionState,
    PipelineExecutionState,
    ClassDiagramExecutionState,
    ComposableExecutionState {}

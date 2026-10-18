/**
 * Segregated interfaces for CanvasBlock geometry, styling, metadata, and per-kind payloads.
 * Implements Interface Segregation Principle for canvas block data structures.
 */

import type { LocalizedValue } from '../../i18n/localizedValue';
import type { JSONContent } from '@tiptap/core';
import type { NetworkDevice } from './networkDevices';
import type { GraphState, TuringMachineState, VizStep, VisualizationState } from '../types/visualizationState';

export interface LocalizedDoc {
  he: JSONContent;
  en: JSONContent;
}

export type BlockVariant = 'text' | 'proof' | 'callout' | 'code' | (string & Record<never, never>);

export interface BlockGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex?: number;
  locked?: boolean;
}

export interface BlockStyling {
  fontScale?: number;
  accentOverride?: string;
  dir?: 'rtl' | 'ltr';
  variant?: BlockVariant;
  style?: 'plain' | 'card';
  showTitle?: boolean;
}

export interface BlockMetadata {
  id: string;
  title?: string | LocalizedValue;
  customTitle?: string;
  groupId?: string;
}

export interface CanvasBlockBase extends BlockGeometry, BlockStyling, BlockMetadata {}

export interface PdfBlockContent {
  kind: 'pdf';
  src: string;
}

export interface ImageBlockContent {
  kind: 'image';
  src: string;
  alt?: string | LocalizedValue;
}

export interface VideoBlockContent {
  kind: 'video';
  src: string;
  poster?: string;
}

export interface YouTubeBlockContent {
  kind: 'youtube';
  videoId: string;
  start?: number;
}

export interface RichTextBlockContent {
  kind: 'richText';
  body: string | LocalizedValue;
  doc?: JSONContent | LocalizedDoc;
  variant?: BlockVariant;
}

export interface BoxBlockContent {
  kind: 'box';
  childIds: string[];
  variant?: BlockVariant;
}

export interface GraphBlockContent {
  kind: 'graph';
  state: GraphState;
}

export interface AutomataBlockContent {
  kind: 'automata';
  state: TuringMachineState;
}

export interface StepPlayerBlockContent {
  kind: 'stepPlayer';
  steps: VizStep<VisualizationState>[];
  stageWidths?: number[];
}

export interface ConnectorBlockContent {
  kind: 'connector';
  fromBlockId: string;
  toBlockId: string;
  fromSide?: 'top' | 'right' | 'bottom' | 'left';
  toSide?: 'top' | 'right' | 'bottom' | 'left';
  label?: string | LocalizedValue;
  style?: 'arrow' | 'line';
}

/**
 * Independent, freely-placeable diagram node (Phase 7 Stage 2b follow-up) —
 * unrelated to graphTypes.ts's GraphNode, which lives nested inside a
 * kind:'graph' block's own state. A shape block is a top-level CanvasBlock
 * in its own right, connectable to anything via kind:'connector'.
 */
export interface ShapeBlockContent {
  kind: 'shape';
  shape: 'circle' | 'rect' | 'diamond' | NetworkDevice;
  label: string;
  /** Automata: renders an inner ring (double circle/box) marking an accepting state. */
  accept?: boolean;
  /** Automata: renders a short incoming arrow stub marking the initial state. */
  start?: boolean;
}

/**
 * Data block (Phase 25). One kind, two formats — halves the fixed
 * registry/AI-schema overhead vs. shipping two separate kinds.
 * Read-only in v1: sort/filter/inline-edit are explicitly out of scope
 * (they'd be a spreadsheet, which is its own app).
 */
export type DataBlockFormat = 'table' | 'json';

export interface DataBlockContent {
  kind: 'data';
  format: DataBlockFormat;
  columns?: (string | LocalizedValue)[];
  rows?: (string | LocalizedValue)[][];
  data?: unknown;
}

export type CanvasBlock =
  | (CanvasBlockBase & PdfBlockContent)
  | (CanvasBlockBase & ImageBlockContent)
  | (CanvasBlockBase & VideoBlockContent)
  | (CanvasBlockBase & YouTubeBlockContent)
  | (CanvasBlockBase & RichTextBlockContent)
  | (CanvasBlockBase & BoxBlockContent)
  | (CanvasBlockBase & GraphBlockContent)
  | (CanvasBlockBase & AutomataBlockContent)
  | (CanvasBlockBase & StepPlayerBlockContent)
  | (CanvasBlockBase & ConnectorBlockContent)
  | (CanvasBlockBase & ShapeBlockContent)
  | (CanvasBlockBase & DataBlockContent);

export type CanvasBlockKind = CanvasBlock['kind'];

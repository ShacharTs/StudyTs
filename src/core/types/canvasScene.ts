/**
 * Multi-modal canvas scene contract.
 * Composes segregated domain interfaces for geometry, styling, content, and metadata.
 */

import { normalizeUserText, type LocalizedValue } from '../../i18n/localizedValue';
import type {
  CanvasBlock,
  CanvasBlockKind,
  CanvasBlockBase,
  BlockGeometry,
  BlockStyling,
  BlockMetadata,
  BlockVariant,
  LocalizedDoc,
  PdfBlockContent,
  ImageBlockContent,
  VideoBlockContent,
  YouTubeBlockContent,
  RichTextBlockContent,
  BoxBlockContent,
  GraphBlockContent,
  AutomataBlockContent,
  StepPlayerBlockContent,
  ConnectorBlockContent,
  ShapeBlockContent,
} from '../canvasBlocks/canvasBlockTypes';
import type { JSONContent } from '@tiptap/core';

/**
 * Segregated interfaces for SceneNode elements within composite Box blocks.
 * Implements Interface Segregation Principle for nested scene nodes.
 */


interface SceneNodeBase {
  id: string;
  dir?: 'rtl' | 'ltr';
}

export interface SceneTextNode extends SceneNodeBase {
  kind: 'text';
  body: string | LocalizedValue;
  doc?: JSONContent | LocalizedDoc;
}

interface SceneBlockRefNode {
  id: string;
  kind: 'blockRef';
  blockId: string;
}

export interface SceneBoxNode extends SceneNodeBase {
  kind: 'box';
  title?: string | LocalizedValue;
  variant?: BlockVariant;
  childIds: string[];
}

export type SceneNode = SceneTextNode | SceneBlockRefNode | SceneBoxNode;

export { normalizeUserText };

export type {
  CanvasBlock,
  CanvasBlockKind,
  CanvasBlockBase,
  BlockGeometry,
  BlockStyling,
  BlockMetadata,
  BlockVariant,
  LocalizedDoc,
  PdfBlockContent,
  ImageBlockContent,
  VideoBlockContent,
  YouTubeBlockContent,
  RichTextBlockContent,
  BoxBlockContent,
  GraphBlockContent,
  AutomataBlockContent,
  StepPlayerBlockContent,
  ConnectorBlockContent,
  ShapeBlockContent,
  SceneBlockRefNode,
};

export type PageSize = 'A4';
export type CanvasOrientation = 'portrait' | 'landscape';

export type CanvasBackgroundPattern = 'dots' | 'grid' | 'isometric' | 'blueprint' | 'mesh' | 'blank';

export interface CanvasSceneMetadata {
  id: string;
  title: string | LocalizedValue;
  canvasSize: { width: number; height: number };
  version?: number;
  updatedAt?: string;
  pageSize?: PageSize;
  orientation?: CanvasOrientation;
  boundaryVisible?: boolean;
  backgroundPattern?: CanvasBackgroundPattern;
  margin?: number; // page margin in millimeters, for the printable-area guide
}

export interface CanvasPage {
  id: string;
  name: string;
  blocks: CanvasBlock[];
  backgroundPattern?: CanvasBackgroundPattern;
  pageSize?: PageSize;
}

export interface CanvasSceneStructure {
  blocks: CanvasBlock[];
  nodes?: Record<string, SceneNode>;
  pages?: CanvasPage[];
  activePageIndex?: number;
}

export interface CanvasScene extends CanvasSceneMetadata, CanvasSceneStructure {}

export type SceneOp =
  | { op: 'setField'; targetId: string; fields: Record<string, unknown> }
  | { op: 'setGeometry'; targetId: string; x: number; y: number; width: number; height: number }
  | { op: 'insertBlock'; block: CanvasBlock; afterId?: string; pageId?: string }
  | { op: 'deleteNode'; targetId: string }
  | { op: 'insertItem'; parentBoxId: string; index: number; item: SceneNode }
  | { op: 'moveItem'; itemId: string; toParentBoxId: string; toIndex: number }
  | { op: 'splitText'; targetId: string; caretOffset: number; insertItem: SceneNode }
  | { op: 'replaceScene'; blocks: CanvasBlock[] };

export type ManualSceneOp =
  | SceneOp
  | { op: 'replaceBoxContent'; boxId: string; nodes: Record<string, SceneNode>; childIds: string[] }
  | { op: 'replaceBlock'; targetId: string; block: Record<string, unknown> }
  | { op: 'tidyLayout'; pageId?: string; gap?: number; overflow?: 'newPage' | 'none' }
  | { op: 'moveBlockToPage'; targetId: string; pageId: string; afterId?: string; y?: number; create?: boolean }
  | { op: 'addPage'; name?: string; afterPageId?: string; id?: string }
  | { op: 'deletePage'; pageId: string }
  | { op: 'movePage'; pageId: string; toIndex: number }
  | { op: 'renamePage'; pageId: string; newName: string };

export {
  objectTypeDefaults,
  createPage,
  createDoc,
  createObject,
  OVERLAY_LAYER,
  CONNECTOR_LAYER,
  MAX_OBJECT_LAYER,
} from './model/sceneModel';
export type {
  ObjectType,
  ShapeKind,
  SceneObject,
  Orientation,
  PaperSize,
  Page,
  PagePatch,
  DocState,
  ObjectPatch,
} from './model/sceneModel';
export {
  addObjectCommand,
  removeObjectCommand,
  patchObjectCommand,
  addPageCommand,
  removePageCommand,
  movePageCommand,
  patchPageCommand,
  compositeCommand,
  moveObjectsToPageCommand,
} from './commands/canvasCommands';
export type { CommandApi, Command } from './commands/canvasCommands';
export { createCommandApi } from './store/commandApi';
export {
  createDocumentSlice,
  isValidDocShape,
  createHistorySlice,
  createSelectionSlice,
  createViewportSlice,
  createInteractionSlice,
} from './store/editorSlices';
export type {
  DocumentSlice,
  HistorySlice,
  SelectionSlice,
  ViewportSlice,
  InteractionSlice,
  ToolKind,
  PortSide,
  TabKind,
  DraftEdge,
  EditorState,
} from './store/editorSlices';
export { useCanvasStore, useObject, useIsSelected } from './store/useCanvasStore';
export {
  addObject,
  removeObject,
  removeObjects,
  patchObject,
  setProp,
  toggleLock,
  toggleHide,
  groupMembers,
  groupSelection,
  ungroupSelection,
  alignLeft,
  alignRight,
  alignCenterH,
  alignTop,
  alignBottom,
  alignMiddle,
  distributeH,
  distributeV,
  copySelection,
  cutSelection,
  pasteClipboard,
  duplicateSelection,
} from './store/objectActions';
export {
  bringToFront,
  sendToBack,
  bringForward,
  sendBackward,
  reorderOne,
  pageStack,
} from './store/layerOrdering';
export {
  addPage,
  removePage,
  movePage,
  patchPage,
  toggleOrientation,
  setPageMargin,
  setPagePaperSize,
} from './store/pageActions';
export {
  moveObjectsToPage,
  moveObjectsToNewPage,
  planPageMove,
  fitDeltaToPage,
} from './store/pageObjectMoves';
export type { PagePlacement, PageMovePlan } from './store/pageObjectMoves';
export { convertSceneToDocState } from '@core/canvasBlocks/sceneDocConverter';
export { saveDoc, loadDoc as loadDocFromServer } from './persistence/sceneStorageApi';
export {
  clampZoom,
  PX_PER_MM,
  PAPER_SIZES_MM,
  DEFAULT_PAPER_SIZE,
  GRID_MM,
  MARGIN_MM_DEFAULT,
  mmToPx,
  pxToMm,
  pageSizeMm,
  clampToPage,
  clampBoxToPage,
  snapToGrid,
} from './model/sceneModel';

import { useObject, useIsSelected, useCanvasStore, groupMembers, OVERLAY_LAYER, type SceneObject } from '@canvasStore';
import { useObjectDrag } from '../interaction/useObjectDrag';
import { SelectionBox } from './SelectionBox';
import { PortDots } from '../connectors/PortDots';
import { startInteriorArrow } from '../connectors/usePortDrag';
import { useHoverIntent } from './useHoverIntent';
import { unboundLinePad } from '../connectors/connectorGeometry';
import { useBoundEdgeGeometry, placeholderWrapperStyle } from '../connectors/useBoundEdgeGeometry';
import { useContextMenu } from '../contextMenu/contextMenuStore';
import styles from './ObjectPlaceholder.module.css';
import { ShapeView } from '../objectViews/ShapeView';
import { StateNodeView } from '../objectViews/StateNodeView';
import { ConnectorView } from '../connectors/ConnectorView';
import { FormulaView } from '../objectViews/FormulaView';
import { ImageView } from '../objectViews/ImageView';
import { TextView } from '../objectViews/TextView';
import { UmlClassView } from '../objectViews/UmlClassView';
import { TableView } from '../objectViews/TableView';

interface ContentOpts {
  onEdgeContextMenu?: (e: React.MouseEvent) => void;
}

const CONTENT_BY_TYPE: Partial<Record<SceneObject['type'], (obj: SceneObject, opts: ContentOpts) => React.ReactNode>> = {
  shape: (obj) => <ShapeView obj={obj} />,
  node: (obj) => <StateNodeView obj={obj} />,
  line: (obj, opts) => <ConnectorView obj={obj} onContextMenu={opts.onEdgeContextMenu} />,
  edge: (obj, opts) => <ConnectorView obj={obj} onContextMenu={opts.onEdgeContextMenu} />,
  formula: (obj) => <FormulaView obj={obj} />,
  image: (obj) => <ImageView obj={obj} />,
  text: (obj) => <TextView obj={obj} />,
  'uml-class': (obj) => <UmlClassView obj={obj} />,
  table: (obj) => <TableView obj={obj} />,
};

function renderObjectContent(obj: SceneObject, opts: ContentOpts = {}): React.ReactNode {
  const renderer = CONTENT_BY_TYPE[obj.type];
  return renderer ? renderer(obj, opts) : obj.type;
}

interface CanvasObjectFrameProps {
  objectId: string;
  pageId: string;
}

/** Shift or Ctrl click: add the object's group to the selection, or take it out when all of it is already selected. */
function toggleGroupSelection(objectId: string): void {
  const s = useCanvasStore.getState();
  const members = groupMembers(objectId);
  const allSelected = members.every((id) => s.selectedIds.includes(id));
  s.select(allSelected ? s.selectedIds.filter((id) => !members.includes(id)) : [...new Set([...s.selectedIds, ...members])]);
}

export function CanvasObjectFrame({ objectId, pageId }: CanvasObjectFrameProps) {
  const obj = useObject(objectId);
  const selected = useIsSelected(objectId);
  const startDrag = useObjectDrag(objectId, pageId);
  const boundEdgeBox = useBoundEdgeGeometry(obj);
  const isBoundEdge = boundEdgeBox !== null;
  const { hovered, handlers } = useHoverIntent();

  if (!obj || obj.hidden) return null;

  const canConnect = obj.type === 'node' || obj.type === 'shape';
  const pad = unboundLinePad(obj);
  const box = boundEdgeBox ?? { minX: obj.x - pad.x, minY: obj.y - pad.y, boxW: obj.w + 2 * pad.x, boxH: obj.h + 2 * pad.y };

  const onPointerDown = (e: React.PointerEvent) => {
    const s = useCanvasStore.getState();
    s.setCurrentPageId(pageId);
    const isMultiKey = e.shiftKey || e.ctrlKey || e.metaKey;
    const isAlreadySelected = s.selectedIds.includes(objectId);

    if (e.button !== 0) {
      if (!isAlreadySelected) {
        s.select(groupMembers(objectId));
      }
      return;
    }

    // Alt-drag from inside a shape starts an arrow there; Shift stays multi-select.
    if (e.altKey && canConnect && startInteriorArrow(objectId, pageId, e)) return;

    if (isMultiKey) {
      toggleGroupSelection(objectId);
      return;
    }

    if (!isAlreadySelected) {
      s.select(groupMembers(objectId));
    }
    startDrag(e);
  };

  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const s = useCanvasStore.getState();
    s.setCurrentPageId(pageId);
    if (!s.selectedIds.includes(objectId)) {
      s.select([objectId]);
    }
    useContextMenu.getState().open(e.clientX, e.clientY);
  };

  const content = renderObjectContent(obj, { onEdgeContextMenu: onContextMenu });

  const computedZIndex = selected ? OVERLAY_LAYER : obj.zIndex;

  return (
    <div
      className={styles.placeholder}
      data-object-id={obj.id}
      onPointerDown={isBoundEdge ? undefined : onPointerDown}
      onContextMenu={onContextMenu}
      {...handlers}
      style={placeholderWrapperStyle(box, isBoundEdge, obj, computedZIndex)}
    >
      {content}
      {canConnect ? <PortDots obj={obj} pageId={pageId} show={hovered} /> : null}
      {selected ? <SelectionBox id={obj.id} pageId={pageId} boundLine={boundEdgeBox} /> : null}
    </div>
  );
}

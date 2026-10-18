import { DEVICE_SIZE_PX, deviceShapeId, isNetworkDevice, type NetworkDevice } from './networkDevices';
import { toMm, type ConvertedSceneObject } from './convertedSceneObject';

type BlockRecord = Record<string, unknown>;

interface BlockDimensions {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

const fontSizeOf = (block: BlockRecord, fallback: number): number => {
  const size = block.fontSize;
  return typeof size === 'number' && size >= 6 && size <= 72 ? size : fallback;
};

/** A graph node that names a network device becomes that device's shape, label underneath, instead of a circle. */
export function convertDeviceNode(node: Record<string, unknown>, device: NetworkDevice, startX: number, startY: number): ConvertedSceneObject {
  const id = String(node.id || `node-${Math.random().toString(36).slice(2, 7)}`);
  const size = DEVICE_SIZE_PX[device];
  return {
    id,
    type: 'shape',
    x: startX + toMm(node.x, 0),
    y: startY + toMm(node.y, 0),
    w: toMm(size.width, 18),
    h: toMm(size.height, 18),
    rotation: 0,
    zIndex: 1,
    locked: false,
    hidden: false,
    anchorId: null,
    groupId: null,
    props: {
      shape: deviceShapeId(device),
      label: String(node.label || id),
      labelPlacement: 'below',
      fill: 'transparent',
      stroke: 'var(--text-1)',
      strokeWidth: 0.4,
      labelColor: 'var(--text-1)',
      fontSize: 10,
    },
  };
}

/** A zone frame: a dashed rounded box behind its devices, titled at its top edge. */
export function convertGraphZone(zone: Record<string, unknown>, blockId: string, startX: number, startY: number): ConvertedSceneObject {
  return {
    id: `zone-${blockId}-${String(zone.id)}`,
    type: 'shape',
    x: startX + toMm(zone.x, 0),
    y: startY + toMm(zone.y, 0),
    w: toMm(zone.width, 60),
    h: toMm(zone.height, 40),
    rotation: 0,
    zIndex: 0,
    locked: false,
    hidden: false,
    anchorId: null,
    groupId: null,
    props: {
      shape: 'rounded',
      label: String(zone.label ?? zone.id),
      labelPlacement: 'top',
      fill: 'transparent',
      stroke: 'var(--text-2)',
      strokeWidth: 0.3,
      strokeStyle: 'dashed',
      labelColor: 'var(--text-2)',
      fontSize: 10,
    },
  };
}

/** A top-level `shape` block: a circle/box/diamond outline, or a network device icon with its label underneath. */
export function convertShapeBlock(block: BlockRecord, d: BlockDimensions): ConvertedSceneObject {
  const device = isNetworkDevice(block.shape) ? block.shape : null;
  const outline = block.shape === 'rect' || block.shape === 'diamond' ? block.shape : 'ellipse';
  return {
    ...d,
    type: 'shape',
    rotation: 0,
    zIndex: 1,
    locked: false,
    hidden: false,
    anchorId: null,
    groupId: null,
    props: {
      shape: device ? deviceShapeId(device) : outline,
      label: String(block.label ?? ''),
      ...(device ? { labelPlacement: 'below' } : {}),
      fill: 'transparent',
      stroke: 'var(--text-1)',
      strokeWidth: 0.4,
      labelColor: 'var(--text-1)',
      fontSize: fontSizeOf(block, 11),
    },
  };
}

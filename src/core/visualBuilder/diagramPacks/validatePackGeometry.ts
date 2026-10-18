import { PACK_LIMITS, PACK_STROKE_SCALINGS, type StylePackIssue } from './stylePackFormat';
import { checkArray, checkEnum, checkId, checkNumberIn, checkUnknownFields, isRecord, packIssue } from './validatePackPrimitives';

const UNIT_RANGE: readonly [number, number] = [0, 1];
const SIGNED_UNIT_RANGE: readonly [number, number] = [-1, 1];

export function checkView(value: unknown, path: string): StylePackIssue[] {
  if (!isRecord(value)) return [packIssue(path, 'bad-size', 'view must be an object with w and h')];
  const range: readonly [number, number] = PACK_LIMITS.viewUnits;
  return [
    ...checkUnknownFields(value, ['w', 'h'], path),
    ...checkNumberIn(value.w, range, `${path}.w`, 'bad-size'),
    ...checkNumberIn(value.h, range, `${path}.h`, 'bad-size'),
  ];
}

export function checkStrokeScaling(value: unknown, path: string): StylePackIssue[] {
  return checkEnum(value, PACK_STROKE_SCALINGS, path, 'bad-enum');
}

export function checkOutline(value: unknown, path: string): StylePackIssue[] {
  if (value === 'rect' || value === 'ellipse') return [];
  if (!isRecord(value) || !Array.isArray(value.polygon)) {
    return [packIssue(path, 'bad-shape', 'outline is rect, ellipse or an object with a polygon')];
  }
  const { min, max } = PACK_LIMITS.outlinePoints;
  return [
    ...checkUnknownFields(value, ['polygon'], path),
    ...checkArray(value.polygon, [min, max], `${path}.polygon`, 'too-many', (point, pointPath) => checkPoint(point, pointPath, UNIT_RANGE)),
  ];
}

export function checkAnchors(value: unknown, path: string): StylePackIssue[] {
  const { min, max } = PACK_LIMITS.anchors;
  return checkArray(value, [min, max], path, 'too-many', checkAnchor);
}

function checkAnchor(value: unknown, path: string): StylePackIssue[] {
  if (!isRecord(value)) return [packIssue(path, 'bad-value', 'anchor must be an object')];
  return [
    ...checkUnknownFields(value, ['id', 'x', 'y', 'nx', 'ny'], path),
    ...checkId(value.id, `${path}.id`),
    ...checkNumberIn(value.x, UNIT_RANGE, `${path}.x`, 'bad-value'),
    ...checkNumberIn(value.y, UNIT_RANGE, `${path}.y`, 'bad-value'),
    ...checkNumberIn(value.nx, SIGNED_UNIT_RANGE, `${path}.nx`, 'bad-value'),
    ...checkNumberIn(value.ny, SIGNED_UNIT_RANGE, `${path}.ny`, 'bad-value'),
  ];
}

function checkPoint(value: unknown, path: string, range: readonly [number, number]): StylePackIssue[] {
  if (!Array.isArray(value) || value.length !== 2) return [packIssue(path, 'bad-value', 'point must be [x, y]')];
  return [
    ...checkNumberIn(value[0], range, `${path}[0]`, 'bad-value'),
    ...checkNumberIn(value[1], range, `${path}[1]`, 'bad-value'),
  ];
}

/** One editor scene object as the converter produces it (millimetres, defaults filled in). */
export interface ConvertedSceneObject {
  id: string;
  type: 'shape' | 'node' | 'edge' | 'line' | 'formula' | 'image' | 'text' | 'uml-class' | 'table';
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  zIndex: number;
  locked: boolean;
  hidden: boolean;
  anchorId: string | null;
  groupId: string | null;
  props: Record<string, unknown>;
}


const PX_TO_MM = 25.4 / 96;

export function toMm(px: unknown, fallback: number): number {
  const num = typeof px === 'number' && Number.isFinite(px) ? px : fallback;
  return Math.round(num * PX_TO_MM * 10) / 10;
}


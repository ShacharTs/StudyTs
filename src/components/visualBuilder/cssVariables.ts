import type { CSSProperties } from 'react';

// Dynamic values reach the CSS module through a custom property, never through a styled property.
export const cssVariable = (name: string, value: string): CSSProperties => ({ [name]: value }) as CSSProperties;

export const pointVariables = (x: number, y: number): CSSProperties => ({ ...cssVariable('--x', `${x}px`), ...cssVariable('--y', `${y}px`) });

export const menuVariables = (x: number, y: number, rows: number): CSSProperties => ({ ...pointVariables(x, y), ...cssVariable('--rows', String(rows)) });

export const clipVariables = (at: number, duration: number, pxPerSec: number): CSSProperties => ({
  ...cssVariable('--left', `${(at / 1000) * pxPerSec}px`),
  ...cssVariable('--width', `${(duration / 1000) * pxPerSec}px`),
});

export const pixelVariable = (pixels: number): CSSProperties => cssVariable('--at', `${pixels}px`);

export const swatchVariable = (color: string): CSSProperties => cssVariable('--swatch', color);

// Colour choices offered by the builder. Values are theme tokens, so diagrams follow the light/dark theme.
export interface ColorChoice {
  name: string;
  value: string;
}

export const COLOR_CHOICES: ColorChoice[] = [
  { name: 'Blue', value: 'var(--viz-blue)' },
  { name: 'Purple', value: 'var(--viz-purple)' },
  { name: 'Cyan', value: 'var(--viz-cyan)' },
  { name: 'Green', value: 'var(--accent-green)' },
  { name: 'Yellow', value: 'var(--viz-yellow)' },
  { name: 'Orange', value: 'var(--viz-orange)' },
  { name: 'Pink', value: 'var(--viz-pink)' },
  { name: 'Red', value: 'var(--accent-danger)' },
  { name: 'Amber', value: 'var(--accent)' },
  { name: 'White', value: 'var(--text-primary)' },
];

export const DEFAULT_SHAPE_COLOR = COLOR_CHOICES[0].value;
export const GLOW_ON = 'drop-shadow(0 0 14px currentColor)';
export const GLOW_OFF = 'drop-shadow(0 0 0px currentColor)';
export const DIMMED_OPACITY = 0.3;

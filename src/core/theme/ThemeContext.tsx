/**
 * Theme Context for Complexity Web.
 * Manages Accent (Ember, Blurple, Red, Pink, Green, White, Gold) and
 * Block Style (Outline, Filled, Ghost).
 * Dynamically applies Nocturne CSS variables to document root.
 */

import { createContext, useContext } from 'react';

export type AccentHue = 'blue' | 'ember' | 'blurple' | 'red' | 'pink' | 'green' | 'gold' | 'white';
export type BlockStyle = 'outline' | 'filled' | 'ghost';
export type UiScale = 'default' | 'medium' | 'large' | 'xlarge';
export type ThemeMode = 'light' | 'dark';

export const UI_SCALE_CONFIG: Record<
  UiScale,
  { label: string; factor: number; percent: string; description: string }
> = {
  default: { label: 'Default', factor: 1.0, percent: '100%', description: 'Standard 100% scale' },
  medium: { label: 'Medium', factor: 1.15, percent: '115%', description: '115% scale for 1440p' },
  large: { label: 'Large', factor: 1.3, percent: '130%', description: '130% scale for 27"+ monitors' },
  xlarge: { label: 'Extra Large', factor: 1.45, percent: '145%', description: '145% scale for 4K' },
};

export const ACCENT_PALETTES: Record<
  AccentHue,
  { label: string; ac: string; hi: string; a08: string; a18: string; a35: string; description: string }
> = {
  blue: {
    label: 'Blue',
    ac: '#6478f5',
    hi: '#8795ff',
    a08: 'rgba(100, 120, 245, 0.09)',
    a18: 'rgba(100, 120, 245, 0.19)',
    a35: 'rgba(100, 120, 245, 0.38)',
    description: 'Default blue accent',
  },
  ember: {
    label: 'Ember',
    ac: '#c98a3a',
    hi: '#dd9c47',
    a08: 'rgba(201, 138, 58, 0.09)',
    a18: 'rgba(201, 138, 58, 0.19)',
    a35: 'rgba(201, 138, 58, 0.38)',
    description: 'Warm amber — original course accent',
  },
  blurple: {
    label: 'Blurple',
    ac: '#9184d9',
    hi: '#b5abfc',
    a08: 'rgba(145, 132, 217, 0.09)',
    a18: 'rgba(145, 132, 217, 0.19)',
    a35: 'rgba(145, 132, 217, 0.38)',
    description: 'Purple-blue — modern Discord vibe',
  },
  red: {
    label: 'Red',
    ac: '#cf6055',
    hi: '#e58279',
    a08: 'rgba(207, 96, 85, 0.09)',
    a18: 'rgba(207, 96, 85, 0.19)',
    a35: 'rgba(207, 96, 85, 0.38)',
    description: 'Coral red — high contrast alerts',
  },
  pink: {
    label: 'Pink',
    ac: '#cf6f9c',
    hi: '#e894ba',
    a08: 'rgba(207, 111, 156, 0.09)',
    a18: 'rgba(207, 111, 156, 0.19)',
    a35: 'rgba(207, 111, 156, 0.38)',
    description: 'Rose pink — friendly accent',
  },
  green: {
    label: 'Green',
    ac: '#4aa683',
    hi: '#6cc9a0',
    a08: 'rgba(74, 166, 131, 0.09)',
    a18: 'rgba(74, 166, 131, 0.19)',
    a35: 'rgba(74, 166, 131, 0.38)',
    description: 'Teal green — success & growth',
  },
  gold: {
    label: 'Gold',
    ac: '#d4a843',
    hi: '#f0c96b',
    a08: 'rgba(212, 168, 67, 0.09)',
    a18: 'rgba(212, 168, 67, 0.19)',
    a35: 'rgba(212, 168, 67, 0.38)',
    description: 'Rich gold — premium feel',
  },
  white: {
    label: 'White',
    ac: '#e2e8f0',
    hi: '#ffffff',
    a08: 'rgba(255, 255, 255, 0.09)',
    a18: 'rgba(255, 255, 255, 0.19)',
    a35: 'rgba(255, 255, 255, 0.38)',
    description: 'Pure white — minimal high contrast',
  },
};


export interface ThemeContextType {
  accent: AccentHue;
  setAccent: (accent: AccentHue) => void;
  blockStyle: BlockStyle;
  setBlockStyle: (style: BlockStyle) => void;
  uiScale: UiScale;
  setUiScale: (scale: UiScale) => void;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

export const ThemeContext = createContext<ThemeContextType>({
  accent: 'blue',
  setAccent: () => {},
  blockStyle: 'outline',
  setBlockStyle: () => {},
  uiScale: 'default',
  setUiScale: () => {},
  mode: 'dark',
  setMode: () => {},
});

export const useTheme = () => useContext(ThemeContext);

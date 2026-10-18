import React, { useState, useEffect } from 'react';
import { ACCENT_PALETTES, UI_SCALE_CONFIG, ThemeContext, type AccentHue, type BlockStyle, type UiScale, type ThemeMode } from './ThemeContext';
import { STORAGE_KEYS } from '@core/shared/storageKeys';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [accent, setAccentState] = useState<AccentHue>(() => {
    const saved = (localStorage.getItem(STORAGE_KEYS.accent) || localStorage.getItem('complexity_accent')) as AccentHue;
    return saved && saved in ACCENT_PALETTES ? saved : 'ember';
  });

  const [blockStyle, setBlockStyleState] = useState<BlockStyle>(() => {
    const saved = (localStorage.getItem(STORAGE_KEYS.blockStyle) || localStorage.getItem('complexity_blockstyle')) as BlockStyle;
    return saved === 'filled' || saved === 'ghost' ? saved : 'outline';
  });

  const [uiScale, setUiScaleState] = useState<UiScale>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.uiScale) as UiScale;
    return saved && saved in UI_SCALE_CONFIG ? saved : 'default';
  });

  const [mode, setModeState] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.themeMode) as ThemeMode;
    if (saved === 'light' || saved === 'dark') return saved;
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }
    return 'dark';
  });

  const setAccent = (newAccent: AccentHue) => {
    setAccentState(newAccent);
    localStorage.setItem(STORAGE_KEYS.accent, newAccent);
  };

  const setBlockStyle = (newStyle: BlockStyle) => {
    setBlockStyleState(newStyle);
    localStorage.setItem(STORAGE_KEYS.blockStyle, newStyle);
  };

  const setUiScale = (newScale: UiScale) => {
    setUiScaleState(newScale);
    localStorage.setItem(STORAGE_KEYS.uiScale, newScale);
  };

  const setMode = (newMode: ThemeMode) => {
    setModeState(newMode);
    localStorage.setItem(STORAGE_KEYS.themeMode, newMode);
  };

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', mode);
    const p = ACCENT_PALETTES[accent] ?? ACCENT_PALETTES.ember;
    root.style.setProperty('--ac', p.ac);
    root.style.setProperty('--ac-hi', p.hi);
    root.style.setProperty('--ac-08', p.a08);
    root.style.setProperty('--ac-18', p.a18);
    root.style.setProperty('--ac-35', p.a35);
    root.style.setProperty('--accent', p.ac);
    root.style.setProperty('--accent-bright', p.hi);

    const outlineFill = mode === 'light' ? '#f0efec' : '#1b1b21';
    const nf = blockStyle === 'filled' ? p.a18 : blockStyle === 'ghost' ? 'transparent' : outlineFill;
    root.style.setProperty('--nf', nf);
    root.style.setProperty('--nsk', p.ac);

    const scaleFactor = UI_SCALE_CONFIG[uiScale]?.factor ?? 1.0;
    root.style.setProperty('--ui-scale', String(scaleFactor));
    root.style.setProperty('--topbar-height', `${Math.round(48 * scaleFactor)}px`);
    root.style.setProperty('--ribbon-height', `${Math.round(72 * scaleFactor)}px`);
  }, [accent, blockStyle, uiScale, mode]);

  return (
    <ThemeContext.Provider
      value={{ accent, setAccent, blockStyle, setBlockStyle, uiScale, setUiScale, mode, setMode }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

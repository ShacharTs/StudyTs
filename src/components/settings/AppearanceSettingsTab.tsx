import React from 'react';
import { useTheme, ACCENT_PALETTES, UI_SCALE_CONFIG, type AccentHue, type UiScale, type ThemeMode } from '../../core/theme/ThemeContext';
import { useLanguageSetting } from '../../i18n/languageContext';
import { SETTINGS_TEXT } from '../../i18n/dictionary';

const ACCENTS: AccentHue[] = ['ember', 'blurple', 'red', 'pink', 'green', 'gold', 'white'];
const UI_SCALES: UiScale[] = ['default', 'medium', 'large', 'xlarge'];
const THEME_MODES: ThemeMode[] = ['dark', 'light'];

interface AppearanceSettingsTabProps {
  val: (input?: unknown) => string;
}

export const AppearanceSettingsTab: React.FC<AppearanceSettingsTabProps> = ({ val }) => {
  const { accent, setAccent, uiScale, setUiScale, mode, setMode } = useTheme();
  const { lang, setLang, languages } = useLanguageSetting();

  const modeLabel = (m: ThemeMode) =>
    m === 'light' ? val(SETTINGS_TEXT.themeModeLight) : val(SETTINGS_TEXT.themeModeDark);

  return (
    <div className="settings-tab-container">
      <div className="settings-section-card">
        <div className="settings-section-title">{val(SETTINGS_TEXT.themeMode)}</div>
        <div className="settings-lang-row">
          {THEME_MODES.map((m) => {
            const isSelected = mode === m;
            return (
              <button
                key={m}
                type="button"
                className={`mcp-btn ${isSelected ? 'primary' : ''}`}
                onClick={() => setMode(m)}
                data-testid={`appearance-theme-mode-${m}`}
              >
                {modeLabel(m)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="settings-section-card">
        <div className="settings-section-title">{val(SETTINGS_TEXT.accentColor)}</div>
        <div className="accent-picker-grid">
          {ACCENTS.map((acc) => {
            const p = ACCENT_PALETTES[acc];
            const isSelected = accent === acc;
            return (
              <button
                key={acc}
                type="button"
                onClick={() => setAccent(acc)}
                title={p.label}
                className={`accent-color-btn ${isSelected ? 'selected' : ''}`}
                style={{ background: p.hi }}
              >
                {isSelected && <span className="accent-color-btn-dot" />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="settings-section-card">
        <div className="settings-section-title">UI Scale / Interface Size</div>
        <div className="settings-lang-row">
          {UI_SCALES.map((scaleKey) => {
            const item = UI_SCALE_CONFIG[scaleKey];
            const isSelected = uiScale === scaleKey;
            return (
              <button
                key={scaleKey}
                type="button"
                className={`mcp-btn ${isSelected ? 'primary' : ''}`}
                onClick={() => setUiScale(scaleKey)}
                title={item.description}
              >
                {item.label} ({item.percent})
              </button>
            );
          })}
        </div>
      </div>

      <div className="settings-section-card">
        <div className="settings-section-title">{val(SETTINGS_TEXT.language)}</div>
        <div className="settings-lang-row">
          {languages.map((item) => {
            const isSelected = item.id === lang;
            return (
              <button
                key={item.id}
                type="button"
                className={`mcp-btn ${isSelected ? 'primary' : ''}`}
                onClick={() => setLang(item.id)}
                data-testid={`appearance-lang-${item.id}`}
              >
                {item.flag} {item.nativeName || item.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

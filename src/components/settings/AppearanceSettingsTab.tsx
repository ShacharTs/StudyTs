import React from 'react';
import { useTheme, UI_SCALE_CONFIG, type UiScale, type ThemeMode } from '../../core/theme/ThemeContext';
import { useLanguageSetting } from '../../i18n/languageContext';
import { SETTINGS_TEXT } from '../../i18n/dictionary';

const UI_SCALES: UiScale[] = ['default', 'medium', 'large', 'xlarge'];
const THEME_MODES: ThemeMode[] = ['dark', 'light'];

interface AppearanceSettingsTabProps {
  val: (input?: unknown) => string;
}

export const AppearanceSettingsTab: React.FC<AppearanceSettingsTabProps> = ({ val }) => {
  const { uiScale, setUiScale, mode, setMode } = useTheme();
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

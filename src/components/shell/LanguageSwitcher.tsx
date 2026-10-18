// src/components/shell/LanguageSwitcher.tsx
import React, { useState, useRef, useEffect } from 'react';
import { Globe, ChevronDown, Check } from 'lucide-react';
import { useLanguage } from '../../i18n/languageContext';
import { translateAppShell } from '../../i18n/appShell/translateAppShell';
import { SETTINGS_TEXT } from '../../i18n/dictionary';
import styles from './LanguageSwitcher.module.css';

interface LanguageSwitcherProps {
  className?: string;
  style?: React.CSSProperties;
}

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({ className, style }) => {
  const { lang, languages, currentLanguage, setLang, val } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSelect = (selectedLang: string) => {
    setLang(selectedLang);
    setIsOpen(false);
  };

  const headerLabel = val(SETTINGS_TEXT.selectLanguage);

  return (
    <div ref={containerRef} className={`${styles.container} ${className ?? ''}`} style={style}>
      <button
        type="button"
        className={`${styles.triggerBtn} ${isOpen ? styles.triggerBtnActive : ''}`}
        onClick={() => setIsOpen((prev) => !prev)}
        data-testid="language-switcher-btn"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        title={translateAppShell('switchLanguageTooltip', lang)}
      >
        <span className={styles.flag} aria-hidden="true">
          {currentLanguage.flag || <Globe size={14} strokeWidth={1.8} />}
        </span>
        <span className={styles.label} dir="ltr">
          {currentLanguage.nativeName || currentLanguage.label}
        </span>
        <ChevronDown size={12} className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`} />
      </button>

      {isOpen && (
        <div
          className={styles.dropdown}
          role="listbox"
          aria-label={headerLabel}
          data-testid="language-dropdown-menu"
        >
          <div className={styles.dropdownHeader}>{headerLabel}</div>
          {languages.map((item) => {
            const isSelected = item.id === lang;
            return (
              <button
                key={item.id}
                type="button"
                role="option"
                aria-selected={isSelected}
                data-testid={`language-option-${item.id}`}
                className={`${styles.menuItem} ${isSelected ? styles.menuItemActive : ''}`}
                onClick={() => handleSelect(item.id)}
              >
                <div className={styles.menuItemContent}>
                  <span className={styles.flag} aria-hidden="true">
                    {item.flag}
                  </span>
                  <span className={styles.menuItemNative} dir={item.direction}>
                    {item.nativeName}
                  </span>
                  <span className={styles.menuItemCode}>({item.id.toUpperCase()})</span>
                </div>
                {isSelected && <Check size={13} className={styles.checkIcon} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

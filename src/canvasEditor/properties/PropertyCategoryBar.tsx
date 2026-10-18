import { useTranslation } from '@i18n';
import type { PropertyCategory } from './propertyCategories';
import styles from './PropertiesPanel.module.css';

interface PropertyCategoryBarProps {
  categories: readonly PropertyCategory[];
  active: PropertyCategory;
  onSelect: (category: PropertyCategory) => void;
}

/** Native buttons keep keyboard reach and Enter/Space activation without extra handlers. */
export function PropertyCategoryBar({ categories, active, onSelect }: PropertyCategoryBarProps) {
  const { val } = useTranslation();
  return (
    <div role="group" aria-label={val({ key: 'canvasBlocks.properties.categories.label' })} className={styles.categoryBar}>
      {categories.map((category) => (
        <button
          key={category}
          type="button"
          aria-pressed={category === active}
          className={styles.categoryButton}
          onClick={() => onSelect(category)}
        >
          {val({ key: `canvasBlocks.properties.categories.${category}` })}
        </button>
      ))}
    </div>
  );
}

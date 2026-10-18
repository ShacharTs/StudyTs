import { ArrangeAlignGroups } from './ArrangeAlignGroups';
import styles from './Ribbon.module.css';

export function HomeRibbon() {
  return (
    <div className={styles.ribbon}>
      <ArrangeAlignGroups includeGroupButtons={true} />
    </div>
  );
}

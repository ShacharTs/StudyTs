import type { SceneObject } from '@canvasStore';
import styles from './ObjectViews.module.css';

export function ImageView({ obj }: { obj: SceneObject }) {
  const src = (obj.props.src as string) ?? '';
  if (!src) {
    return (
      <div className={styles.imageEmpty}>
        no image
      </div>
    );
  }
  return (
    <img
      src={src}
      draggable={false}
      className={styles.image}
      style={{
        objectFit: (obj.props.fit as React.CSSProperties['objectFit']) ?? 'contain',
        opacity: (obj.props.opacity as number) ?? 1,
      }}
    />
  );
}

import { useTranslation } from '@i18n';
import { IconButton } from './controls/IconButton';
import { TextButton } from './controls/TextButton';
import styles from './VisualBuilder.module.css';

interface ZoomControlsProps {
  onFit: () => void;
  onActualSize: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
}

export function ZoomControls({ onFit, onActualSize, onZoomIn, onZoomOut }: ZoomControlsProps) {
  const { val } = useTranslation();
  return (
    <span className={styles.zoomControls}>
      <IconButton icon="zoom-out" label={val({ key: 'visualAuthoring.timeline.zoomOut' })} onClick={onZoomOut} />
      <IconButton icon="zoom-in" label={val({ key: 'visualAuthoring.timeline.zoomIn' })} onClick={onZoomIn} />
      <TextButton label={val({ key: 'visualAuthoring.timeline.actualSize' })} onClick={onActualSize} />
      <IconButton icon="fit" label={val({ key: 'visualAuthoring.timeline.fit' })} onClick={onFit} />
    </span>
  );
}

import { usePageDrop } from '../interaction/pageDropStore';
import styles from './Viewport.module.css';

/** Outlines of the objects being dragged to another page. Pages clip their content, so the preview lives above them. */
export function PageDropGhosts() {
  const ghosts = usePageDrop((s) => s.ghosts);
  return (
    <>
      {ghosts.map((g, i) => (
        <div key={i} className={`${styles.ghost} print-hide`} style={{ left: g.left, top: g.top, width: g.width, height: g.height }} />
      ))}
    </>
  );
}

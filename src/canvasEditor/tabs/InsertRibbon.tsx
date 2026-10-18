import { importImage } from '../interaction/importImage';
import { useCanvasStore, addObject } from '@canvasStore';
import { useLeftDockStore } from '../panelLayout/panelDockStores';
import { RibbonGroup } from './RibbonGroup';
import { TableSizePicker } from './TableSizePicker';
import styles from './Ribbon.module.css';

export function InsertRibbon() {
  const insertText = () => {
    const obj = addObject('text', { w: 50, h: 20 });
    useCanvasStore.getState().select([obj.id]);
  };

  const insertShape = () => {
    const obj = addObject('shape', { props: { shape: 'rect' } });
    useCanvasStore.getState().select([obj.id]);
  };

  const insertNode = () => {
    const obj = addObject('node');
    useCanvasStore.getState().select([obj.id]);
  };

  const insertLine = () => {
    const obj = addObject('line', { w: 40, h: 0 });
    useCanvasStore.getState().select([obj.id]);
  };

  const insertFormula = () => {
    const obj = addObject('formula', { props: { latex: '\\text{formula}' } });
    useCanvasStore.getState().select([obj.id]);
  };

  const toggleToolbox = () => {
    useLeftDockStore.getState().openFloating('toolbox', 260, 420);
  };

  return (
    <div className={styles.ribbon}>
      <RibbonGroup label="Media">
        <button
          id="insert-image"
          className={styles.buttonSmall}
          onClick={importImage}
          title="Insert Image"
        >
          Image
        </button>
        <button
          id="insert-formula"
          className={styles.buttonSmall}
          onClick={insertFormula}
          title="Insert Formula"
        >
          Formula
        </button>
        <TableSizePicker />
      </RibbonGroup>

      <RibbonGroup label="Objects">
        <button
          id="insert-text"
          className={styles.buttonSmall}
          onClick={insertText}
          title="Insert Text Box"
        >
          Text
        </button>
        <button
          id="toggle-toolbox"
          className={styles.buttonSmall}
          onClick={toggleToolbox}
          title="Open Shapes & UML Toolbox"
        >
          Toolbox (UML)
        </button>
        <button
          id="insert-shape"
          className={styles.buttonSmall}
          onClick={insertShape}
          title="Insert Rectangle Shape"
        >
          Shape
        </button>
        <button
          id="insert-node"
          className={styles.buttonSmall}
          onClick={insertNode}
          title="Insert State Node"
        >
          State Node
        </button>
        <button
          id="insert-line"
          className={styles.buttonSmall}
          onClick={insertLine}
          title="Insert Line / Arrow"
        >
          Line
        </button>
      </RibbonGroup>
    </div>
  );
}

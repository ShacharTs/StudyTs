import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { insertTable, clampTableDim, MAX_TABLE_ROWS, MAX_TABLE_COLS } from './insertTable';
import ribbon from './Ribbon.module.css';
import styles from './TableSizePicker.module.css';

const GRID_ROWS = 8;
const GRID_COLS = 8;

export function TableSizePicker() {
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState({ rows: 2, cols: 2 });
  const [rows, setRows] = useState(3);
  const [cols, setCols] = useState(3);
  const [error, setError] = useState('');

  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: 0, top: 0 });

  const toggle = () => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) setPos({ left: rect.left, top: rect.bottom + 4 });
    setOpen((v) => !v);
  };

  // Outside click closes the popout; the button itself is excluded so its own toggle still works.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (popoverRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  const insert = (r: number, c: number) => {
    const placed = insertTable(r, c);
    setError(placed ? '' : 'No free space on this page');
    if (placed) setOpen(false);
  };

  return (
    <div className={styles.anchor}>
      <button
        id="insert-table"
        className={ribbon.buttonSmall}
        ref={buttonRef}
        onClick={toggle}
        title="Insert Table"
        aria-expanded={open}
      >
        Table
      </button>
      {open ? createPortal(
        <div ref={popoverRef} className={styles.popover} style={pos} role="dialog" aria-label="Table size">
          <div className={styles.grid} onMouseLeave={() => setHover({ rows: 0, cols: 0 })}>
            {Array.from({ length: GRID_ROWS * GRID_COLS }, (_, i) => {
              const r = Math.floor(i / GRID_COLS) + 1;
              const c = (i % GRID_COLS) + 1;
              const lit = r <= hover.rows && c <= hover.cols;
              return (
                <button
                  key={i}
                  type="button"
                  aria-label={`${r} by ${c}`}
                  className={lit ? `${styles.cell} ${styles.lit}` : styles.cell}
                  onMouseEnter={() => setHover({ rows: r, cols: c })}
                  onClick={() => insert(r, c)}
                />
              );
            })}
          </div>
          <div className={styles.readout}>{hover.rows > 0 ? `${hover.rows} × ${hover.cols}` : 'Pick a size'}</div>
          <div className={styles.custom}>
            <input
              type="number"
              aria-label="Rows"
              min={1}
              max={MAX_TABLE_ROWS}
              value={rows}
              onChange={(e) => setRows(clampTableDim(e.target.valueAsNumber, MAX_TABLE_ROWS))}
            />
            <span>×</span>
            <input
              type="number"
              aria-label="Columns"
              min={1}
              max={MAX_TABLE_COLS}
              value={cols}
              onChange={(e) => setCols(clampTableDim(e.target.valueAsNumber, MAX_TABLE_COLS))}
            />
            <button className={ribbon.buttonSmall} onClick={() => insert(rows, cols)}>Insert</button>
          </div>
          {error ? <div className={styles.error}>{error}</div> : null}
        </div>,
        document.body
      ) : null}
    </div>
  );
}

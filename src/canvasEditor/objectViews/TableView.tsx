import { useState, useRef, useLayoutEffect } from 'react';
import { BlurCommitInput } from '@components/shared/BlurCommitInput';
import { useCanvasStore, setProp, patchObject, pxToMm, mmToPx, type SceneObject } from '@canvasStore';
import { autoColumnFractions, minFitWidthPx } from '@core/geometry/tableColumns';
import { detectDirectionFromText } from '@i18n/localizedValue';
import { useIsPagePreview } from '@canvasEditor/page/pagePreviewContext';
import { LatexText } from './LatexText';
import { themedColor } from './themeColors';
import { readColumnWidths, hasStoredColumnWidths, useColumnResize } from './useColumnResize';
import { isAutoFit, widthCapMm, pageWidthOf, fitWidthMm, widthDiffers } from './autoFit';
import styles from './TableView.module.css';

const MAX_DIM = 50;
const HEIGHT_EPSILON_MM = 0.5;
const PT_TO_PX = 96 / 72;

interface Position { row: number; col: number }

function readDim(value: unknown, fallback: number): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : fallback;
  return Math.min(MAX_DIM, Math.max(1, n));
}

/** Cells are stored loosely (AI output, resized tables), so always read through a rows x cols grid. */
function gridOf(cells: unknown, rows: number, cols: number): string[][] {
  const source = Array.isArray(cells) ? (cells as unknown[][]) : [];
  return Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => {
      const cell = Array.isArray(source[r]) ? source[r][c] : '';
      return typeof cell === 'string' ? cell : String(cell ?? '');
    })
  );
}

/** A fraction as a percentage custom property; the CSS module decides which property uses it. */
function percentVar(name: string, fraction: number): React.CSSProperties {
  return { [name]: `${fraction * 100}%` } as React.CSSProperties;
}

export function TableView({ obj }: { obj: SceneObject }) {
  const p = obj.props;
  const rows = readDim(p.rows, 2);
  const cols = readDim(p.cols, 3);
  const grid = gridOf(p.cells, rows, cols);
  const headerRow = p.headerRow !== false;
  const fontSize = (p.fontSize as number) ?? 11;

  const [editing, setEditing] = useState<Position | null>(null);
  const [draft, setDraft] = useState('');
  const tableRef = useRef<HTMLTableElement>(null);
  const isPreview = useIsPagePreview();
  const autoFit = isAutoFit(p);
  const ownWidths = hasStoredColumnWidths(p.colWidths, cols);
  const fontPx = fontSize * PT_TO_PX;
  // Best fit: with no widths of its own, each column is as wide as its content needs, like a browser's auto table layout.
  const bestFit = autoFit && !ownWidths ? autoColumnFractions(grid, cols, { widthPx: mmToPx(obj.w), fontPx }) : undefined;
  const { widths, startDrag } = useColumnResize(obj.id, readColumnWidths(p.colWidths, cols, bestFit), tableRef);

  // Min fit: the table is only as wide as its text needs on single lines, never wider than the width it was given.
  useLayoutEffect(() => {
    if (isPreview || !autoFit || ownWidths) return;
    const capMm = widthCapMm(obj, pageWidthOf(obj.id));
    const w = fitWidthMm(pxToMm(minFitWidthPx(grid, cols, fontPx)), capMm);
    if (widthDiffers(w, obj.w) || obj.props.maxWidth !== capMm) {
      useCanvasStore.getState()._api.patchRaw(obj.id, { w, props: { ...obj.props, maxWidth: capMm } });
    }
  }, [grid, cols, fontPx, autoFit, ownWidths, obj, isPreview]);

  // The table lays out at its natural height (rows wrap their text); the object box follows it both ways,
  // so a short cell never leaves a huge box behind and long text never spills out of it.
  useLayoutEffect(() => {
    const el = tableRef.current;
    if (isPreview || !el) return;
    const naturalH = Math.ceil(pxToMm(el.offsetHeight) * 2) / 2;
    if (Math.abs(naturalH - obj.h) > HEIGHT_EPSILON_MM) patchObject(obj.id, { h: naturalH }, 'Auto-fit table');
  }, [p.cells, p.colWidths, draft, fontSize, rows, cols, obj.w, obj.h, obj.id, isPreview]);

  const commit = (value: string) => {
    if (!editing) return;
    const next = grid.map((row) => [...row]);
    next[editing.row][editing.col] = value;
    setProp(obj.id, 'cells', next, 'Edit table cell');
  };

  const cssVars = {
    '--fs': `${fontSize}pt`,
    '--c': themedColor(p.color as string | undefined),
    '--fill': (p.fill as string) ?? 'var(--ac-18)',
    '--stroke': themedColor(p.stroke as string | undefined),
    '--sw': `${(p.strokeWidth as number) ?? 0.3}mm`,
  } as React.CSSProperties;

  let borderLeft = 0;

  return (
    <div className={styles.root} style={cssVars}>
      <table ref={tableRef} className={styles.table}>
        <colgroup>
          {widths.map((w, c) => <col key={c} className={styles.col} style={percentVar('--w', w)} />)}
        </colgroup>
        <tbody>
          {grid.map((row, r) => (
            <tr key={r}>
              {row.map((text, c) => {
                const Cell = headerRow && r === 0 ? 'th' : 'td';
                const active = editing?.row === r && editing.col === c;
                return (
                  <Cell
                    key={c}
                    className={styles.cell}
                    dir={detectDirectionFromText(active ? draft : text)}
                    onDoubleClick={() => {
                      setDraft(text);
                      setEditing({ row: r, col: c });
                    }}
                  >
                    {active ? (
                      <BlurCommitInput
                        multiline
                        autoFocus
                        rows={draft.split('\n').length}
                        value={text}
                        className={styles.editor}
                        onChange={setDraft}
                        onCommit={commit}
                        onFinish={() => setEditing(null)}
                        onCancel={() => setEditing(null)}
                      />
                    ) : (
                      <LatexText text={text} />
                    )}
                  </Cell>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {widths.slice(0, -1).map((w, i) => {
        borderLeft += w;
        return (
          <div
            key={i}
            className={styles.handle}
            style={percentVar('--left', borderLeft)}
            onPointerDown={startDrag(i)}
            title="Drag to resize column"
          />
        );
      })}
    </div>
  );
}

import { useRef } from 'react';
import { useCanvasStore, addObject, setProp } from '@canvasStore';
import { FileRibbon } from './FileRibbon';
import { HomeRibbon } from './HomeRibbon';
import { LayoutRibbon } from './LayoutRibbon';
import { InsertRibbon } from './InsertRibbon';
import styles from './RibbonBar.module.css';
import { MATH_GROUPS } from './mathSymbols';
import { RibbonGroup } from './RibbonGroup';
import equationRibbonStyles from './Ribbon.module.css';

function snippetFor(groupName: string, tooltip: string): string {
  const item = MATH_GROUPS.find((g) => g.name === groupName)?.items.find((i) => i.t === tooltip);
  return item?.s ?? '';
}

const STRUCTURES = [
  { label: '÷', name: 'Fraction', snippet: snippetFor('Structures', 'Fraction') },
  { label: '√', name: 'Radical', snippet: snippetFor('Structures', 'Square root') },
  { label: 'xⁿ', name: 'Power', snippet: snippetFor('Structures', 'Superscript') },
  { label: '∫', name: 'Integral', snippet: snippetFor('N-ary', 'Integral') },
  { label: 'Σ', name: 'Sum', snippet: snippetFor('N-ary', 'Summation') },
  { label: '[ ]', name: 'Matrix', snippet: snippetFor('Structures', 'Matrix') },
];

function insertMath(snippet: string): void {
  if (!snippet) return;
  const clean = snippet.replace('$0', '').trim();

  const s = useCanvasStore.getState();
  const id = s.selectedIds.length === 1 ? s.selectedIds[0] : null;
  const selected = id ? s.doc.objects[id] : undefined;
  if (selected?.type === 'formula') {
    const current = (selected.props.latex as string) ?? '';
    setProp(id!, 'latex', current ? `${current} ${clean}` : clean, 'Insert into formula');
    return;
  }

  const obj = addObject('formula', { props: { latex: clean, display: false } });
  s.select([obj.id]);
}

export function EquationRibbon() {
  return (
    <div className={equationRibbonStyles.ribbon}>
      <RibbonGroup label="Insert">
        <button
          id="insert-equation"
          className={equationRibbonStyles.buttonSmall}
          onClick={() => insertMath('\\text{formula}')}
          title="Insert Formula"
        >
          Formula
        </button>
      </RibbonGroup>

      <RibbonGroup label="Structures">
        <div className={equationRibbonStyles.structureGrid}>
          {STRUCTURES.map((s) => (
            <button
              key={s.name}
              className={equationRibbonStyles.symbolKey}
              title={`Insert ${s.name}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => insertMath(s.snippet)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </RibbonGroup>

      <RibbonGroup label="Symbols Keyboard">
        <div className={equationRibbonStyles.symbolScroll}>
          {MATH_GROUPS.map((group) => (
            <div key={group.name} className={equationRibbonStyles.symbolCategory} title={group.name}>
              {group.items.map((it) => (
                <button
                  key={it.s}
                  className={equationRibbonStyles.symbolKey}
                  title={it.t ?? it.s.trim()}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => insertMath(it.s)}
                >
                  {it.l}
                </button>
              ))}
            </div>
          ))}
        </div>
      </RibbonGroup>
    </div>
  );
}

export function RibbonBar() {
  const currentTab = useCanvasStore((s) => s.currentTab);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleWheel = (e: React.WheelEvent) => {
    if (scrollRef.current) {
      e.preventDefault();
      scrollRef.current.scrollLeft += e.deltaY > 0 ? 40 : -40;
    }
  };

  return (
    <div id="ribbon-bar" ref={scrollRef} className={`${styles.ribbon} print-hide`} onWheel={handleWheel}>
      {currentTab === 'File' && <FileRibbon />}
      {currentTab === 'Home' && <HomeRibbon />}
      {currentTab === 'Equation' && <EquationRibbon />}
      {currentTab === 'Insert' && <InsertRibbon />}
      {currentTab === 'Layout' && <LayoutRibbon />}
    </div>
  );
}

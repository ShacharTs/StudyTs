import {
  useCanvasStore,
  patchPage,
  setPageMargin,
  setPagePaperSize,
  addPage,
  removePage,
  PAPER_SIZES_MM,
  type PaperSize,
} from '@canvasStore';
import { useRightDockStore } from '../panelLayout/panelDockStores';
import { Crosshair, Grid3x3, Magnet, Ruler } from 'lucide-react';
import { useTranslation } from '@i18n';
import { useGuidesVisibility } from '../view/viewPreferences';
import { RibbonGroup } from './RibbonGroup';
import { ArrangeAlignGroups } from './ArrangeAlignGroups';
import styles from './Ribbon.module.css';

const MARGIN_PRESETS: Record<string, number> = { None: 0, Narrow: 10, Normal: 20, Wide: 30 };

function PagesGroup({ pages, pageId }: { pages: unknown[]; pageId: string }) {
  const openPages = () => {
    useRightDockStore.getState().openFloating('pages', 260, 360);
  };

  return (
      <RibbonGroup label="Pages">
        <button
          className={styles.buttonSmall}
          onClick={() => addPage(pages.length - 1)}
          title="Add New Page"
        >
          + Add
        </button>
        <button
          className={styles.buttonSmall}
          disabled={pages.length <= 1}
          onClick={() => removePage(pageId)}
          title="Delete Page"
        >
          Delete
        </button>
        <button
          className={styles.buttonSmall}
          onClick={openPages}
          title="Pages Panel"
        >
          Pages ({pages.length})
        </button>
      </RibbonGroup>
  );
}

type Page = ReturnType<typeof useCanvasStore.getState>['doc']['pages'][number] | undefined;

function PageSetupGroup({ page: currentPage, pageId }: { page: Page; pageId: string }) {
  const marginPreset = currentPage
    ? Object.entries(MARGIN_PRESETS).find(([, v]) => v === currentPage.margin)?.[0] ?? 'Custom'
    : 'Normal';

  return (
      <RibbonGroup label="Page Setup">
        <select
          className={styles.select}
          title="Page Orientation"
          value={currentPage?.orientation ?? 'portrait'}
          onChange={(e) =>
            patchPage(
              pageId,
              { orientation: e.target.value as 'portrait' | 'landscape' },
              'Set orientation'
            )
          }
        >
          <option value="portrait">Portrait</option>
          <option value="landscape">Landscape</option>
        </select>
        <select
          className={styles.select}
          title="Page Margins"
          value={marginPreset === 'Custom' ? '' : marginPreset}
          onChange={(e) =>
            e.target.value && setPageMargin(pageId, MARGIN_PRESETS[e.target.value])
          }
        >
          {marginPreset === 'Custom' && <option value="">Custom</option>}
          {Object.keys(MARGIN_PRESETS).map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <select
          className={styles.select}
          title="Paper Size"
          value={currentPage?.paperSize ?? 'A4'}
          onChange={(e) => setPagePaperSize(pageId, e.target.value as PaperSize)}
        >
          {Object.keys(PAPER_SIZES_MM).map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </RibbonGroup>
  );
}

export function LayoutRibbon() {
  const pages = useCanvasStore((s) => s.doc.pages);
  const currentPageId = useCanvasStore((s) => s.currentPageId);
  const currentPage =
    useCanvasStore((s) => s.doc.pages.find((p) => p.id === s.currentPageId)) ?? pages[0];
  const showGrid = useCanvasStore((s) => s.showGrid);
  const snapEnabled = useCanvasStore((s) => s.snapEnabled);
  const toggleGrid = useCanvasStore((s) => s.toggleGrid);
  const showPrintMargins = useCanvasStore((s) => s.showPrintMargins);
  const togglePrintMargins = useCanvasStore((s) => s.togglePrintMargins);
  const toggleSnap = useCanvasStore((s) => s.toggleSnap);
  const showGuides = useGuidesVisibility((s) => s.showGuides);
  const toggleGuides = useGuidesVisibility((s) => s.toggleGuides);
  const { val } = useTranslation();

  const pageId = currentPage?.id ?? currentPageId;
  return (
    <div className={styles.ribbon}>
      <PagesGroup pages={pages} pageId={pageId} />

      <PageSetupGroup page={currentPage} pageId={pageId} />

      <RibbonGroup label="Grid & Guides">
        <button
          className={`${styles.buttonSmall} ${showGrid ? styles.active : ''}`}
          onClick={toggleGrid}
          title="Toggle Grid"
        >
          <Grid3x3 size={14} />
        </button>
        <button
          className={`${styles.buttonSmall} ${snapEnabled ? styles.active : ''}`}
          onClick={toggleSnap}
          title="Toggle Snap to Grid/Objects"
        >
          <Magnet size={14} />
        </button>
        <button
          className={`${styles.buttonSmall} ${showGuides ? styles.active : ''}`}
          onClick={toggleGuides}
          title={val({ key: 'canvasBlocks.layout.guides.title' })}
        >
          <Crosshair size={14} />
        </button>
        <button
          className={`${styles.buttonSmall} ${showPrintMargins ? styles.active : ''}`}
          onClick={togglePrintMargins}
          title="Toggle Margin & Printable-Area Guides"
        >
          <Ruler size={14} />
        </button>
      </RibbonGroup>

      <ArrangeAlignGroups includeGroupButtons={false} />
    </div>
  );
}

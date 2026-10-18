import './print.css';
import { Viewport } from './viewport/Viewport';
import { TabBar } from './tabs/TabBar';
import { RibbonBar } from './tabs/RibbonBar';
import { NavActions } from './tabs/NavActions';
import { BottomToolbar } from './shell/BottomToolbar';
import { StatusBar } from './shell/StatusBar';
import { PanelHost } from './panelLayout/PanelHost';
import { useSceneLoad } from './saving/useSceneLoad';
import { useSceneAutosave } from './saving/sceneSaving';
import { useKeyboardShortcuts } from './keyboard/useKeyboardShortcuts';
import { ContextMenuHost } from './contextMenu/ContextMenuHost';
import { useGridPreferenceSync } from './view/viewPreferences';
import { useCanvasStore } from '@canvasStore';
import { usePublishAppViewContext } from '../ai/context/usePublishAppViewContext';
import { useRegisterViewCommands } from '../ai/context/viewCommands';
import { useMemo } from 'react';
import styles from './CanvasApp.module.css';

interface CanvasAppProps {
  sceneId: string;
}

export function CanvasApp({ sceneId }: CanvasAppProps) {
  const { loading, error } = useSceneLoad(sceneId);
  useSceneAutosave();
  useKeyboardShortcuts();
  useGridPreferenceSync();

  const currentPageId = useCanvasStore((s) => s.currentPageId);
  const selectedCount = useCanvasStore((s) => s.selectedIds.length);
  const undo = useCanvasStore((s) => s.undo);
  const redo = useCanvasStore((s) => s.redo);

  usePublishAppViewContext({ kind: 'canvas', sceneId, pageId: currentPageId, selectedCount });
  useRegisterViewCommands(useMemo(() => ({ undo, redo }), [undo, redo]));

  if (loading) {
    return <div className={styles.app} dir="ltr" data-testid="canvas-app-root">Loading…</div>;
  }

  return (
    <div className={`${styles.app} canvasPrintApp`} dir="ltr" data-testid="canvas-app-root">
      {error && <div className={styles.loadError}>Couldn't load this document: {error}</div>}
      <div className={`${styles.topbar} canvasPrintStage`}>
        <PanelHost side="left" />
        <div className={`${styles.center} canvasPrintStage`}>
          <div className={styles.navRow}>
            <TabBar />
            <NavActions />
          </div>
          <RibbonBar />
          <Viewport />
        </div>
        <PanelHost side="right" />
      </div>
      <BottomToolbar />
      <StatusBar />
      <ContextMenuHost />
    </div>
  );
}
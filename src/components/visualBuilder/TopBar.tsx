import type { ReactNode, RefObject } from 'react';
import { BUILDER_TEXT, useTranslation } from '@i18n';
import type { InsertCommand } from '@core/visualBuilder/galleryModel';
import type { BuilderLayout } from './builderLayout';
import { ControlGroup } from './controls/ControlGroup';
import { ToggleButton } from './controls/ToggleButton';
import { setGridMode, useGridMode, type GridMode } from './gridPreference';
import { IconButton } from './controls/IconButton';
import { MenuButton, type MenuButtonItem } from './controls/MenuButton';
import { TextButton } from './controls/TextButton';
import type { WorkspaceMode } from '@core/visualBuilder/modes/workspaceMode';
import { InsertGallery } from './InsertGallery';
import { ModeMenu } from './ModeMenu';
import styles from './BuilderWorkbench.module.css';

interface TopBarProps {
  animateAnchor?: RefObject<HTMLElement>;
  // A slot for an action that belongs in this row, such as Done editing.
  actionSlot?: ReactNode;
  tool: 'select' | 'connect';
  snap: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onTool: (tool: 'select' | 'connect') => void;
  stepNumber: number;
  insertRequest?: number;
  onInsert: (command: InsertCommand) => void;
  canAnimate: boolean;
  onAnimate: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onSnap: (snap: boolean) => void;
  onHelp: () => void;
  layout: BuilderLayout;
  canRemove: boolean;
  onRemove: () => void;
  // The selected object's settings, in the same row as Animate and Delete.
  selectionSlot?: ReactNode;
  onLayout: (layout: BuilderLayout) => void;
  workspace: { mode: WorkspaceMode; modes: readonly WorkspaceMode[]; showAll: boolean; onMode: (id: string) => void; onShowAll: (showAll: boolean) => void };
  // One Project menu holding local spec, publish and JSON transfer.
  projectSlot?: ReactNode;
}

const text = BUILDER_TEXT;


const LAYOUTS = [
  { value: 'build', text: text.cvBuildLarge, icon: 'layout-build' },
  { value: 'split', text: text.cvSplit, icon: 'layout-split' },
  { value: 'preview', text: text.cvPreviewLarge, icon: 'layout-preview' },
] as const;

const gridItem = (mode: GridMode, current: GridMode, label: string): MenuButtonItem => ({
  label,
  checked: mode === current,
  onSelect: () => setGridMode(mode),
});

export function TopBar(props: TopBarProps) {
  const { val } = useTranslation();
  const layouts = LAYOUTS.map(({ text: name, ...layout }) => ({ ...layout, label: val(name) }));
  const snapLabel = val(text.cvSnapToGrid);
  const grid = useGridMode();
  return (
    <header className={styles.topBar} role="toolbar" aria-label={val(text.cvBuilderSettings)}>
      <ControlGroup label={val(text.cvHistory)}>
        <IconButton icon="undo" label={val(text.cvUndo)} shortcut="Ctrl+Z" disabled={!props.canUndo} onClick={props.onUndo} />
        <IconButton icon="redo" label={val(text.cvRedo)} shortcut="Ctrl+Y" disabled={!props.canRedo} onClick={props.onRedo} />
      </ControlGroup>
      <ControlGroup label={val(text.cvAdd)} divider={Boolean(props.selectionSlot)}>
        <ToggleButton label={val(text.cvArrow)} pressed={props.tool === 'connect'} title={val(text.cvArrow)} onClick={() => props.onTool(props.tool === 'connect' ? 'select' : 'connect')} />
        <InsertGallery stepNumber={props.stepNumber} onInsert={props.onInsert} openRequest={props.insertRequest} mode={props.workspace.mode} showAll={props.workspace.showAll} />
        <span ref={props.animateAnchor} className={styles.anchor}>
        <TextButton label={val(text.cvAnimate)} icon="animate" shortcut="A" title={props.canAnimate ? val(text.cvAnimateSelected) : val(text.cvSelectToAnimate)} disabled={!props.canAnimate} onClick={props.onAnimate} />
        </span>
        <TextButton label={val(text.cvDelete)} icon="trash" tone="danger" disabled={!props.canRemove} onClick={props.onRemove} />
      </ControlGroup>
      {props.selectionSlot && <ControlGroup label={val(text.cvShapeTools)}>{props.selectionSlot}</ControlGroup>}
      <div className={styles.spacer} />
      <ControlGroup label={val(text.cvLayout)}>
        <MenuButton
          label={val(layouts.find((choice) => choice.value === props.layout)?.label ?? text.cvLayout)}
          align="end"
          items={layouts.map((choice) => ({ label: choice.label, icon: choice.icon, checked: choice.value === props.layout, onSelect: () => props.onLayout(choice.value) }))}
        />
      </ControlGroup>
      <ControlGroup label={val(text.cvDocument)}>
        <ModeMenu {...props.workspace} />
        <MenuButton label={val(text.cvView)} align="end" items={[gridItem('none', grid, val(text.cvGridNone)), gridItem('lines', grid, val(text.cvGridLines)), gridItem('dots', grid, val(text.cvGridDots))]} />
        <ToggleButton label={snapLabel} pressed={props.snap} onClick={() => props.onSnap(!props.snap)} />
        {props.projectSlot && (
          <MenuButton label={val(text.cvProject)} align="end" keepMounted>
            {props.projectSlot}
          </MenuButton>
        )}
        {props.actionSlot}
        <IconButton icon="help" label={val(text.cvKeyboardShortcuts)} shortcut="?" onClick={props.onHelp} />
      </ControlGroup>
    </header>
  );
}

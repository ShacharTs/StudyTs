import type { ReactNode } from 'react';
import {
  useCanvasStore,
  duplicateSelection,
  bringForward,
  sendBackward,
  bringToFront,
  sendToBack,
  toggleLock,
  toggleHide,
  groupSelection,
  ungroupSelection,
  alignLeft,
  alignCenterH,
  alignRight,
  alignTop,
  alignMiddle,
  alignBottom,
} from '@canvasStore';
import { useTranslation } from '@i18n';
import {
  Copy,
  SendToBack,
  ArrowDownToLine,
  ArrowUpToLine,
  BringToFront,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Group,
  Ungroup,
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignCenterHorizontal,
  AlignEndHorizontal,
} from 'lucide-react';
import { RibbonGroup } from './RibbonGroup';
import styles from './Ribbon.module.css';

interface ArrangeAlignGroupsProps {
  includeGroupButtons?: boolean;
}

interface ActionButtonProps {
  path: string;
  icon: ReactNode;
  onClick: () => void;
  disabled: boolean;
  reason: string;
  active?: boolean;
}

/** Icon plus visible label; a disabled button shows why it is disabled instead of its action title. */
function ActionButton({ path, icon, onClick, disabled, reason, active = false }: ActionButtonProps) {
  const { val } = useTranslation();
  const label = val({ key: `canvasBlocks.ribbon.${path}.label` });
  const title = val({ key: disabled ? `canvasBlocks.ribbon.reason.${reason}` : `canvasBlocks.ribbon.${path}.title` });
  return (
    <button
      className={`${styles.buttonLabelled} ${active ? styles.isActive : ''}`}
      disabled={disabled}
      onClick={onClick}
      title={title}
    >
      {icon}
      <span className={styles.buttonLabel}>{label}</span>
    </button>
  );
}

export function ArrangeAlignGroups({ includeGroupButtons = false }: ArrangeAlignGroupsProps) {
  const { val } = useTranslation();
  const hasSelection = useCanvasStore((s) => s.selectedIds.length > 0);
  const canAlign = useCanvasStore((s) => s.selectedIds.length >= 2);
  const isLocked = useCanvasStore((s) => !!s.doc.objects[s.selectedIds[0]]?.locked);
  const isHidden = useCanvasStore((s) => !!s.doc.objects[s.selectedIds[0]]?.hidden);
  const canGroup = useCanvasStore((s) => s.selectedIds.length >= 2);
  const canUngroup = useCanvasStore((s) =>
    s.selectedIds.some((id) => !!s.doc.objects[id]?.groupId)
  );

  return (
    <>
      <RibbonGroup label={val({ key: 'canvasBlocks.ribbon.groups.arrange' })}>
        <ActionButton path="arrange.duplicate" icon={<Copy size={14} />} onClick={duplicateSelection} disabled={!hasSelection} reason="needSelection" />
        <ActionButton path="arrange.toBack" icon={<SendToBack size={14} />} onClick={sendToBack} disabled={!hasSelection} reason="needSelection" />
        <ActionButton path="arrange.back" icon={<ArrowDownToLine size={14} />} onClick={sendBackward} disabled={!hasSelection} reason="needSelection" />
        <ActionButton path="arrange.forward" icon={<ArrowUpToLine size={14} />} onClick={bringForward} disabled={!hasSelection} reason="needSelection" />
        <ActionButton path="arrange.toFront" icon={<BringToFront size={14} />} onClick={bringToFront} disabled={!hasSelection} reason="needSelection" />
        <ActionButton
          path={isLocked ? 'arrange.locked' : 'arrange.lock'}
          icon={isLocked ? <Lock size={14} /> : <Unlock size={14} />}
          onClick={toggleLock}
          disabled={!hasSelection}
          reason="needSelection"
          active={isLocked}
        />
        <ActionButton
          path={isHidden ? 'arrange.hidden' : 'arrange.hide'}
          icon={isHidden ? <EyeOff size={14} /> : <Eye size={14} />}
          onClick={toggleHide}
          disabled={!hasSelection}
          reason="needSelection"
          active={isHidden}
        />
        {includeGroupButtons && (
          <>
            <ActionButton path="arrange.group" icon={<Group size={14} />} onClick={groupSelection} disabled={!canGroup} reason="needTwoToGroup" />
            <ActionButton path="arrange.ungroup" icon={<Ungroup size={14} />} onClick={ungroupSelection} disabled={!canUngroup} reason="needGroupedToUngroup" />
          </>
        )}
      </RibbonGroup>

      <RibbonGroup label={val({ key: 'canvasBlocks.ribbon.groups.align' })}>
        <ActionButton path="align.left" icon={<AlignStartVertical size={14} />} onClick={alignLeft} disabled={!canAlign} reason="needTwoToAlign" />
        <ActionButton path="align.center" icon={<AlignCenterVertical size={14} />} onClick={alignCenterH} disabled={!canAlign} reason="needTwoToAlign" />
        <ActionButton path="align.right" icon={<AlignEndVertical size={14} />} onClick={alignRight} disabled={!canAlign} reason="needTwoToAlign" />
        <ActionButton path="align.top" icon={<AlignStartHorizontal size={14} />} onClick={alignTop} disabled={!canAlign} reason="needTwoToAlign" />
        <ActionButton path="align.middle" icon={<AlignCenterHorizontal size={14} />} onClick={alignMiddle} disabled={!canAlign} reason="needTwoToAlign" />
        <ActionButton path="align.bottom" icon={<AlignEndHorizontal size={14} />} onClick={alignBottom} disabled={!canAlign} reason="needTwoToAlign" />
      </RibbonGroup>
    </>
  );
}

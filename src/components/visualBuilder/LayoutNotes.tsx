import { BUILDER_TEXT, useTranslation } from '@i18n';
import { findLayoutIssues, type LayoutIssue, type LayoutIssueKind } from '@core/validation/visualSpec/visualSpecLayout';
import type { VisualSpec } from '@core/types/visualSpec';
import { TextButton } from './controls/TextButton';
import styles from './VisualBuilder.module.css';

export interface LayoutIssueActions {
  select: (id: string) => void;
  bringInside: (id: string) => void;
  remove: (id: string) => void;
}

const KEY = {
  outline: 'layoutOutline',
  crossed: 'layoutCrossed',
  overlap: 'layoutOverlap',
  outside: 'layoutOutside',
  partlyOutside: 'layoutPartlyOutside',
  orphan: 'layoutOrphan',
} as const;

// Moving an orphan cannot put it right, so only Delete and Select apply to it.
const MOVABLE = new Set<LayoutIssueKind>(['outside', 'partlyOutside']);
const ACTIONABLE = new Set<LayoutIssueKind>(['outside', 'partlyOutside', 'orphan']);

function IssueButtons({ id, kind, actions }: { id: string; kind: LayoutIssueKind; actions: LayoutIssueActions }) {
  const { val } = useTranslation();
  return (
    <>
      <TextButton label={val(BUILDER_TEXT.cvSelect)} onClick={() => actions.select(id)} />
      {MOVABLE.has(kind) && <TextButton label={val(BUILDER_TEXT.cvBringInside)} onClick={() => actions.bringInside(id)} />}
      <TextButton label={val(BUILDER_TEXT.cvDelete)} tone="danger" onClick={() => actions.remove(id)} />
    </>
  );
}

export function LayoutNotes({ spec, actions }: { spec: VisualSpec; actions?: LayoutIssueActions }) {
  const { val } = useTranslation();
  const issues = findLayoutIssues(spec);
  if (issues.length === 0) return null;
  // An overlap lists both shapes in `ids`; outline and line crossings name the other one in `other`.
  const wording = (issue: LayoutIssue): string =>
    val(BUILDER_TEXT[KEY[issue.kind]]).replace('{a}', issue.ids[0]).replace('{b}', issue.other ?? issue.ids[1] ?? '');
  return (
    <ul className={styles.hint} aria-label={val(BUILDER_TEXT.cvLayoutNotes)}>
      {issues.map((issue) => (
        <li key={issue.message}>
          {wording(issue)}
          {actions && ACTIONABLE.has(issue.kind) && <IssueButtons id={issue.ids[0]} kind={issue.kind} actions={actions} />}
        </li>
      ))}
    </ul>
  );
}

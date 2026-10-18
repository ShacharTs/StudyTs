import { Fragment, useEffect, useState, type ReactNode } from 'react';
import { stageForScreen, viewBoxOf } from '@core/shared/stageSize';
import { parseVisualSpecJson, type VisualSpec } from '@engine/visualStepPlayer';
import { BuilderWorkbench } from '@components/visualBuilder/BuilderWorkbench';
import { BuilderErrorBoundary } from './BuilderErrorBoundary';
import { VisualStepsShell } from './VisualStepsShell';
import { SpecFileTools } from './SpecFileTools';
import { PublishPanel } from './PublishPanel';
import { downloadTextFile, readFileText } from './visualSpecFileTransfer';
import { lecturePath, type VisualLectureTarget } from './visualAuthoringRoute';
import { useVisualLecture } from './useVisualLecture';
import { useVisualSpecDraft } from './useVisualSpecDraft';
import { useVisualSpecSamples } from './useVisualSpecSamples';
import { useVisualSpecStorage } from './useVisualSpecStorage';
import { useOpenedSpec } from './useOpenedSpec';
import type { VisualSpecStorageStatus } from './useVisualSpecStorage';
import styles from './VisualAuthoringPage.module.css';

/** An empty but valid starting point; real examples are loaded from the course data through the sample picker. */
const BLANK_SPEC: VisualSpec = {
  id: 'new-visual-spec',
  viewBox: viewBoxOf(stageForScreen(window.screen?.width, window.screen?.height)),
  elements: [],
  steps: [{ id: 'start', whatChanged: 'Start', why: '', tweens: [] }],
};

// Module-level so the load effect does not re-run on every render (an inline function would).
const blankLectureSpec = (id: string): VisualSpec => ({ ...BLANK_SPEC, id });

interface VisualAuthoringPageProps {
  /** Key of a saved spec to open on mount (from the /step-player/<key> URL). */
  initialKey?: string | null;
  /** A course topic to edit as its step player; Save then writes into that lecture and opens it. */
  lecture?: VisualLectureTarget | null;
  /** Leaves the page; injectable so tests do not navigate. */
  onNavigate?: (url: string) => void;
  /** Inside a course topic the app shell is already there, so the page renders without its own. */
  embedded?: boolean;
  /** Hands the parent the lecture save, so its Done button can save before it leaves editing. */
  onLectureSaveReady?: (save: () => Promise<boolean>) => void;
  /** Shown in the builder's top row, such as the Done editing button. */
  headerAction?: ReactNode;
}

const navigateTo = (url: string): void => window.location.assign(url);

// Standalone pages get the app shell; a page embedded in a course topic already sits inside it.
function PageFrame({ embedded, children }: { embedded?: boolean; children: ReactNode }) {
  return embedded ? <Fragment>{children}</Fragment> : <VisualStepsShell>{children}</VisualStepsShell>;
}

// A lecture that fails to load or save says so here, since its save bar is gone.
const noticeOf = (loadError: string | null, samplesError: string | null, lectureStatus: VisualSpecStorageStatus): string | null =>
  loadError ?? samplesError ?? (lectureStatus.kind === 'error' ? lectureStatus.message : null);

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

function rememberKeyInUrl(key: string): void {
  const path = `/step-player/${key}`;
  if (window.location.pathname !== path) window.history.replaceState(null, '', path);
}

export function VisualAuthoringPage({ initialKey = null, lecture = null, onNavigate = navigateTo, embedded, onLectureSaveReady, headerAction }: VisualAuthoringPageProps) {
  const draft = useVisualSpecDraft(BLANK_SPEC);
  const { replaceWithSpec } = draft;
  const { samples, error: samplesError, loadSample } = useVisualSpecSamples();
  const { keys, status, save, load } = useVisualSpecStorage();
  const { status: lectureStatus, load: loadLecture, save: saveLecture } = useVisualLecture(lecture);
  const lectureTopicId = lecture?.topicId;
  const [storageKey, setStorageKey] = useState(initialKey ?? '');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [readOnly, setReadOnly] = useState(false);

  useOpenedSpec({
    initialKey,
    lectureTopicId,
    load,
    loadLecture,
    replaceWithSpec,
    setReadOnly,
    blankSpec: blankLectureSpec,
  });

  const canSave = draft.parsed.spec !== null && draft.parsed.problems.length === 0;

  const handleLoadSample = (id: string) => {
    setLoadError(null);
    loadSample(id)
      .then(replaceWithSpec)
      .catch((error: unknown) => setLoadError(messageOf(error)));
  };

  const handleExport = () => {
    downloadTextFile(`${draft.parsed.spec?.id ?? 'visual-spec'}.json`, draft.text);
  };

  const importSpecText = (text: string) => {
    const { spec, problems } = parseVisualSpecJson(text);
    if (spec && problems.length === 0) replaceWithSpec(spec);
    else setLoadError(problems.join('; ') || 'The file is not a visual spec');
  };

  const handleImportFile = (file: File) => {
    setLoadError(null);
    readFileText(file)
      .then(importSpecText)
      .catch((error: unknown) => setLoadError(messageOf(error)));
  };

  const handleSave = async () => {
    if (readOnly || !draft.parsed.spec || !canSave) return;
    if (await save(storageKey, draft.parsed.spec)) rememberKeyInUrl(storageKey);
  };

  const saveLectureDraft = async (): Promise<boolean> => {
    if (readOnly || !lecture || !draft.parsed.spec || !canSave) return false;
    const saved = await saveLecture(draft.parsed.spec);
    if (saved && !embedded) onNavigate(lecturePath(lecture));
    return saved;
  };
  useEffect(() => {
    onLectureSaveReady?.(saveLectureDraft);
  });

  const handleOpen = async (key: string) => {
    const loaded = await load(key);
    if (!loaded) return;
    setStorageKey(key);
    replaceWithSpec(loaded.spec);
    setReadOnly(loaded.readOnly);
    rememberKeyInUrl(key);
  };

  const notice = noticeOf(loadError, samplesError, lectureStatus);

  // An existing lecture is edited in place: no file menu and no publish panel.
  const projectSlot = lecture ? null : (
    <SpecFileTools
      storageKey={storageKey}
      onKeyChange={setStorageKey}
      savedKeys={keys}
      status={status}
      canSave={canSave}
      onSave={() => void handleSave()}
      onOpen={(key) => void handleOpen(key)}
      readOnly={readOnly}
      samples={samples}
      onLoadSample={handleLoadSample}
      onExport={handleExport}
      onImportFile={handleImportFile}
      publish={<PublishPanel spec={canSave ? draft.parsed.spec : null} />}
    />
  );
  return (
    <PageFrame embedded={embedded}>
    <div className={styles.page}>
      {notice && (
        <p role="alert" className={styles.importError}>
          {notice}
        </p>
      )}
      {draft.parsed.spec && (
        <BuilderErrorBoundary specId={draft.parsed.spec.id} specVersion={draft.parsed.spec.specVersion ?? 1} onRecover={readOnly ? undefined : replaceWithSpec}>
          <BuilderWorkbench spec={draft.parsed.spec} previewSpec={draft.previewSpec} onChange={replaceWithSpec} projectSlot={projectSlot} actionSlot={headerAction} readOnly={readOnly} />
        </BuilderErrorBoundary>
      )}
    </div>
    </PageFrame>
  );
}

// src/components/courseHub/EntityEditor.tsx
/**
 * Floating field panel for editing course/week/topic entities in the content
 * editor. Mirrors BlockContentEditor.tsx's contract: local field state, Apply
 * calls onSave with the accumulated diff, no network call here — the three
 * call sites (CourseHub.tsx, HomeDashboard.tsx) own persistence and reload.
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import buttons from './courseHubButtons.module.css';
import { validateSlugForCreate } from './entityEditorSlug';
import { slugInfo, fieldReader, deriveSlug, buildSave, type EntityKind, type FieldReader, type SlugInfo } from './entityEditorLogic';
import { useTranslation, HUB_TEXT, normalizeUserText } from '@i18n';
import styles from './EntityEditor.module.css';
import { detectDirectionFromText } from '@i18n/localizedValue';
import { TopicTypePicker, TopicTypeNote, type TopicContentType } from './TopicTypePicker';
import { pickFunnyTopicTitle } from './funnyTopicTitle';
import { TopicAttachmentsField } from './TopicAttachmentsField';
import { TopicFilePicker } from './TopicFilePicker';
import type { TopicAttachment } from '@core/shared/topicAttachment';

/** A new topic saved without a title gets a joke title, so Apply never dead-ends on an empty name. */
function withFunnyTopicTitle(
  kind: EntityKind,
  isCreating: boolean,
  fields: Record<string, unknown>,
  field: FieldReader,
  val: ReturnType<typeof useTranslation>['val']
): Record<string, unknown> {
  const hasTitle = normalizeUserText(String(field('title', ''))).trim().length > 0;
  if (kind !== 'topic' || !isCreating || hasTitle) return fields;
  return { ...fields, title: val(pickFunnyTopicTitle()) };
}

/** A labelled single-line or multi-line text input for the entity editor; text direction follows what is typed. */

interface TextFieldProps {
  field: FieldReader;
  setField: (key: string, value: unknown) => void;
  name: string;
  label: string;
  placeholder?: string;
  multiline?: boolean;
}

function TextField({ field, setField, name, label, placeholder, multiline = false }: TextFieldProps) {
  const val = normalizeUserText(field(name, ''));
  const dir = detectDirectionFromText(val);
  return (
    <>
      <label className={buttons.label}>{label}</label>
      {multiline ? (
        <textarea
          dir={dir}
          className={buttons.field}
          value={val}
          placeholder={placeholder ?? `${label}...`}
          onChange={(e) => setField(name, e.target.value)}
        />
      ) : (
        <input dir={dir} className={buttons.field} value={val} placeholder={placeholder ?? `${label}...`} onChange={(e) => setField(name, e.target.value)} />
      )}
    </>
  );
}

/** The fields after the title that depend on what is being edited: a course has a description and an icon, a topic a description. */

interface KindFieldsProps {
  kind: EntityKind;
  field: FieldReader;
  setField: (key: string, value: unknown) => void;
}

function KindFields({ kind, field, setField }: KindFieldsProps) {
  const { val } = useTranslation();
  if (kind === 'week') return null;
  return (
    <>
      <TextField field={field} setField={setField} name="description" label={val(HUB_TEXT.fieldDescription)} placeholder={val(HUB_TEXT.descriptionPlaceholder)} multiline />
    </>
  );
}

/** The red message at the top of the entity editor when saving fails. */

function ErrorBanner({ error }: { error: string }) {
  return <div className={styles.errorBanner}>{error}</div>;
}

interface EntityEditorProps {
  kind: EntityKind;
  initial: Record<string, unknown>;
  // Needed to upload attachments to an existing topic; absent when no course is open.
  courseId?: string;
  onSave: (fields: Record<string, unknown>) => Promise<void>;
  onClose: () => void;
}

const HEADING = { course: HUB_TEXT.editCourse, week: HUB_TEXT.editSection, topic: HUB_TEXT.editTopic } as const;
const ID_LABEL = { course: HUB_TEXT.courseIdLabel, week: HUB_TEXT.sectionIdLabel, topic: HUB_TEXT.topicIdLabel } as const;

interface TopicFieldsProps {
  isCreating: boolean;
  initial: Record<string, unknown>;
  courseId?: string;
  field: FieldReader;
  setField: (key: string, value: unknown) => void;
}

/** The topic-only controls: the type choice on create, the type and attachments on edit. */
function TopicFields({ isCreating, initial, courseId, field, setField }: TopicFieldsProps) {
  if (isCreating) {
    const type = field('contentType', 'canvas') as TopicContentType;
    // The document's own name becomes the topic title, so no second name is needed; it can be renamed later.
    const chooseFile = (file: File | null) => {
      setField('pendingFile', file);
      if (file && normalizeUserText(String(field('title', ''))).trim() === '') setField('title', fileTitleOf(file.name));
    };
    const chooseType = (next: TopicContentType) => {
      setField('contentType', next);
      if (next !== 'file') setField('pendingFile', null);
    };
    return (
      <>
        <TopicTypePicker value={type} onChange={chooseType} />
        {type === 'file' && <TopicFilePicker file={field('pendingFile', null) as File | null} onPick={(file) => chooseFile(file)} />}
      </>
    );
  }
  return (
    <>
      <TopicTypeNote kind={initial.kind as string | undefined} />
      {courseId && initial.kind === 'file' && (
        <TopicAttachmentsField
          courseId={courseId}
          topicId={String(initial.id)}
          attachments={field('attachments', []) as TopicAttachment[]}
          onChange={(next) => setField('attachments', next)}
        />
      )}
    </>
  );
}

function fileTitleOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(0, dot) : name;
}

/** Derives the id from the title that will actually be saved, which may be the joke title. */
function buildNamedSave(kind: EntityKind, info: SlugInfo, fields: Record<string, unknown>, initial: Record<string, unknown>) {
  const field = fieldReader(fields, initial);
  const slug = deriveSlug(info, field, normalizeUserText(field('title', '')));
  return buildSave(kind, info, fields, field, slug);
}

export const EntityEditor: React.FC<EntityEditorProps> = ({ kind, initial, courseId, onSave, onClose }) => {
  const { val } = useTranslation();
  const [fields, setFields] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const field = fieldReader(fields, initial);
  const setField = (key: string, value: unknown) => setFields((prev) => ({ ...prev, [key]: value }));

  const info = slugInfo(kind, initial);
  const { isCreating } = info;
  const derivedSlug = deriveSlug(info, field, normalizeUserText(field('title', '')));

  const handleApply = () => {
    const named = withFunnyTopicTitle(kind, isCreating, fields, field, val);
    const { effectiveFields, slugValue } = buildNamedSave(kind, info, named, initial);

    const problem = isCreating ? validateSlugForCreate(slugValue) : null;
    if (problem) {
      setError(problem === 'empty' ? val(HUB_TEXT.idCannotDerive) : val(HUB_TEXT.idInvalid).replace('{id}', slugValue));
      return;
    }

    setSaving(true);
    setError(null);
    onSave(effectiveFields)
      .then(() => onClose())
      .catch((err: Error) => setError(err.message))
      .finally(() => setSaving(false));
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
      className={`${styles.panel} ${buttons.panel}`}
    >
      <div className={styles.header}>
        <span className={styles.heading}>{val(HEADING[kind])}</span>
        <button type="button" onClick={onClose} className={buttons.icon} aria-label={val(HUB_TEXT.close)}><X size={13} /></button>
      </div>
      {error && <ErrorBanner error={error} />}
      <div className={styles.fields}>
        <TextField field={field} setField={setField} name="title" label={val(HUB_TEXT.fieldTitle)} placeholder={val(HUB_TEXT.titlePlaceholder)} />
        {isCreating && (
          <p className={styles.hint}>
            {val(ID_LABEL[kind])}: <code>{derivedSlug || val(HUB_TEXT.idWaitingForTitle)}</code> — {val(HUB_TEXT.idDerivedNote)}
          </p>
        )}
        <KindFields kind={kind} field={field} setField={setField} />
        {kind === 'topic' && (
          <TopicFields isCreating={isCreating} initial={initial} courseId={courseId} field={field} setField={setField} />
        )}
      </div>
      <div className={styles.footer}>
        <button type="button" onClick={handleApply} disabled={saving} className={buttons.primary}>
          {saving ? val(HUB_TEXT.saving) : val(HUB_TEXT.apply)}
        </button>
        <button type="button" onClick={onClose} disabled={saving} className={buttons.secondary}>{val(HUB_TEXT.cancel)}</button>
      </div>
    </motion.div>
  );
};

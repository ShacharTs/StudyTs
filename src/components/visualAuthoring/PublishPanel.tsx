import { PUBLISH_SECTIONS } from '@core/visualSpec/publishOptions';
import type { VisualSpec } from '@engine/visualStepPlayer';
import { usePublishForm, type PublishState } from './usePublishForm';
import { lecturePath } from './visualAuthoringRoute';
import styles from './VisualSpecStorageBar.module.css';

interface PublishPanelProps {
  spec: VisualSpec | null;
}

function PublishStatus({ state }: { state: PublishState }) {
  if (state.kind === 'error') return <span role="alert" className={styles.status} data-kind="error">{state.message}</span>;
  if (state.kind === 'busy') return <span role="status" className={styles.status} data-kind="busy">Publishing…</span>;
  if (state.kind !== 'done') return null;
  return (
    <span role="status" className={styles.status} data-kind="done">
      Published {state.target.topicId}{' '}
      <a href={lecturePath(state.target)}>Open lecture</a>
    </span>
  );
}

export function PublishPanel({ spec }: PublishPanelProps) {
  const form = usePublishForm(spec);
  return (
    <div className={styles.bar} role="group" aria-label="Publish to course">
      <select aria-label="Course" className={styles.select} value={form.courseId} onChange={(event) => form.setCourse(event.target.value)}>
        {form.courses.map((course) => (
          <option key={course.id} value={course.id}>{course.label}</option>
        ))}
      </select>
      <select aria-label="Week" className={styles.select} value={form.weekKey} onChange={(event) => form.setWeek(event.target.value)}>
        {form.weeks.map((week) => (
          <option key={week} value={week}>{week}</option>
        ))}
      </select>
      <select aria-label="Section" className={styles.select} value={form.section} onChange={(event) => form.setSection(event.target.value)}>
        {PUBLISH_SECTIONS.map((section) => (
          <option key={section} value={section}>{section}</option>
        ))}
      </select>
      <input aria-label="Lecture title" className={styles.input} placeholder="Lecture title" value={form.title} onChange={(event) => form.setTitle(event.target.value)} />
      <input aria-label="Topic id" className={styles.input} dir="ltr" placeholder="topic-id" value={form.topicId} onChange={(event) => form.setTopicId(event.target.value)} />
      <button type="button" className={styles.button} disabled={!form.canPublish} onClick={() => void form.publish()}>
        Publish to course
      </button>
      {form.registryError && <span role="alert" className={styles.status} data-kind="error">{form.registryError}</span>}
      <PublishStatus state={form.state} />
    </div>
  );
}

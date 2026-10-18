/** What a multi-canvas PDF contains, in reading order: only canvas topics, each introduced by a divider page. */
export type ExportSection =
  | { kind: 'cover'; title: string; subtitle: string }
  | { kind: 'week'; title: string; kicker: string }
  | { kind: 'topic'; sceneId: string; title: string; kicker: string };

interface PlanTopic { id: string; title?: unknown; kind?: string }
interface PlanWeek { title?: unknown; lectures: PlanTopic[]; practice: PlanTopic[] }
export interface PlanCourse { title?: unknown; subtitle?: unknown; catalog: Record<string, PlanWeek> }

type Resolve = (value?: unknown) => string;

const textOf = (value: unknown, resolve: Resolve): string => (typeof value === 'string' ? value : resolve(value));

function weekSections(week: PlanWeek, resolve: Resolve, weekLabel: string): ExportSection[] {
  const canvases = [...week.lectures, ...week.practice].filter((topic) => topic.kind === 'canvas');
  if (canvases.length === 0) return [];
  const weekTitle = textOf(week.title, resolve);
  return [
    { kind: 'week', title: weekTitle, kicker: weekLabel },
    ...canvases.map((topic, i): ExportSection => ({
      kind: 'topic',
      sceneId: topic.id,
      title: textOf(topic.title, resolve),
      kicker: `${weekTitle} · ${i + 1} / ${canvases.length}`,
    })),
  ];
}

/** The whole course (cover first), or just `onlyWeekKey`'s week. Catalog order is the course order. */
export function planExport(course: PlanCourse, resolve: Resolve, weekLabel: string, onlyWeekKey?: string): ExportSection[] {
  const weeks = Object.entries(course.catalog).filter(([key]) => !onlyWeekKey || key === onlyWeekKey);
  const body = weeks.flatMap(([, week]) => weekSections(week, resolve, weekLabel));
  if (onlyWeekKey || body.length === 0) return body;
  return [{ kind: 'cover', title: textOf(course.title, resolve), subtitle: textOf(course.subtitle, resolve) }, ...body];
}

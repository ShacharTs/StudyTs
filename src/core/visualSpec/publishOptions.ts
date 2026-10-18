export const PUBLISH_SECTIONS = ['lectures', 'practice'] as const;

interface CourseLike {
  id: string;
  code: string;
  catalog: Record<string, unknown>;
}

const TOPIC_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;

export const courseOptions = (registry: Record<string, CourseLike>): Array<{ id: string; label: string }> =>
  Object.values(registry).map((course) => ({ id: course.id, label: course.code }));

export const weekOptions = (registry: Record<string, CourseLike>, courseId: string): string[] =>
  Object.keys(registry[courseId]?.catalog ?? {}).sort();

export const isTopicId = (value: string): boolean => TOPIC_ID.test(value);

export const slugifyTopicId = (title: string): string =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);

// A chosen course or week that is not in the registry (yet) falls back to the first one on offer.
export function resolvePublishChoice(registry: Record<string, CourseLike>, chosenCourse: string, chosenWeek: string) {
  const courses = courseOptions(registry);
  const courseId = courses.some((course) => course.id === chosenCourse) ? chosenCourse : (courses[0]?.id ?? '');
  const weeks = weekOptions(registry, courseId);
  const weekKey = weeks.includes(chosenWeek) ? chosenWeek : (weeks[0] ?? '');
  return { courses, courseId, weeks, weekKey };
}

export type LocalizedText = Record<string, string | undefined>;

export type UserText = string | LocalizedText;

export function isUserText(value: unknown): value is UserText {
  if (typeof value === 'string') return true;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.values(value).some((text) => typeof text === 'string');
}

export function collectCourseMetaProblems(candidate: unknown): string[] {
  const problems: string[] = [];
  if (!candidate || typeof candidate !== 'object') {
    return ['course.json must contain a JSON object'];
  }
  const c = candidate as Record<string, unknown>;
  if (typeof c.id !== 'string') problems.push("course.json missing string field 'id'");
  if (typeof c.code !== 'string') problems.push("course.json missing string field 'code'");
  if (typeof c.icon !== 'string') problems.push("course.json missing string field 'icon'");
  if (typeof c.color !== 'string') problems.push("course.json missing string field 'color'");
  if (typeof c.accent !== 'string') problems.push("course.json missing string field 'accent'");
  for (const key of ['title', 'subtitle', 'description', 'badge']) {
    if (!isUserText(c[key])) problems.push(`course.json missing text or localized field '${key}'`);
  }
  return problems;
}

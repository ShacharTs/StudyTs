/** Recognises the standalone authoring page: /step-player, /step-player/<key> or /step-player?course=..&week=..&section=..&topic=.. */
export interface VisualLectureTarget {
  courseId: string;
  weekKey: string;
  section: string;
  topicId: string;
}

export interface VisualAuthoringPath {
  matches: boolean;
  key: string | null;
  /** Set when the URL names a course topic to edit as a step player. */
  lecture: VisualLectureTarget | null;
}

const NO_MATCH: VisualAuthoringPath = { matches: false, key: null, lecture: null };

function lectureFromSearch(search: string): VisualLectureTarget | null {
  const params = new URLSearchParams(search);
  const courseId = params.get('course');
  const weekKey = params.get('week');
  const section = params.get('section');
  const topicId = params.get('topic');
  return courseId && weekKey && section && topicId ? { courseId, weekKey, section, topicId } : null;
}

export function parseVisualAuthoringPath(pathname: string, search = ''): VisualAuthoringPath {
  const parts = pathname.replace(/^\/+|\/+$/g, '').split('/');
  if (parts[0] !== 'step-player' || parts.length > 2) return NO_MATCH;
  return { matches: true, key: parts[1] ?? null, lecture: lectureFromSearch(search) };
}

export function buildVisualAuthoringUrl(target: VisualLectureTarget): string {
  const params = new URLSearchParams({ course: target.courseId, week: target.weekKey, section: target.section, topic: target.topicId });
  return `/step-player?${params.toString()}`;
}

/** Where the finished lecture lives in the course app. */
export const lecturePath = (target: Pick<VisualLectureTarget, 'courseId' | 'topicId'>): string => `/${target.courseId}/${target.topicId}`;

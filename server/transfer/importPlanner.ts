import { ArchiveCourse, ParsedArchive } from './archiveReader.js';
import { ArchiveKind, ArchiveError } from './archiveManifest.js';
import { COURSE_ID_PATTERN } from './transferLimits.js';

export type ConflictPolicy = 'skip' | 'replace' | 'duplicate';

export interface PlannedCourse {
  sourceId: string;
  targetId: string;
  action: 'create' | 'skip' | 'replace' | 'duplicate';
  conflict: boolean;
  course: ArchiveCourse;
  topicCount: number;
}

export interface ImportPlan {
  kind: ArchiveKind;
  courses: PlannedCourse[] ;
}

export function nextFreeId(base: string, taken: ReadonlySet<string>): string {
  let counter = 2;
  while (counter < 1000) {
    const suffix = `-${counter}`;
    const maxBaseLen = 64 - suffix.length;
    const truncatedBase = base.slice(0, maxBaseLen);
    const candidate = `${truncatedBase}${suffix}`;
    if (!taken.has(candidate) && COURSE_ID_PATTERN.test(candidate)) {
      return candidate;
    }
    counter++;
  }
  throw new ArchiveError('invalid_course', `Unable to find free ID for duplicate of '${base}'`);
}

function resolveCoursePolicy(
  sourceId: string,
  policy: ConflictPolicy | Record<string, ConflictPolicy>,
): ConflictPolicy {
  if (typeof policy === 'string') return policy;
  return policy[sourceId] ?? 'skip';
}

export function planImport(
  archive: ParsedArchive,
  existingIds: ReadonlySet<string>,
  policy: ConflictPolicy | Record<string, ConflictPolicy>,
): ImportPlan {
  const taken = new Set<string>(existingIds);
  const plannedCourses: PlannedCourse[] = [];
  const seenSourceIds = new Set<string>();

  for (const course of archive.courses) {
    const sourceId = course.meta.id;
    if (seenSourceIds.has(sourceId)) {
      throw new ArchiveError('invalid_manifest', `Duplicate course id '${sourceId}' in archive`);
    }
    seenSourceIds.add(sourceId);

    const conflict = existingIds.has(sourceId);
    let action: PlannedCourse['action'];
    let targetId: string;
    let preparedCourse = course;

    if (!conflict) {
      action = 'create';
      targetId = sourceId;
      taken.add(targetId);
    } else {
      const chosenPolicy = resolveCoursePolicy(sourceId, policy);
      if (chosenPolicy === 'skip') {
        action = 'skip';
        targetId = sourceId;
      } else if (chosenPolicy === 'replace') {
        action = 'replace';
        targetId = sourceId;
      } else {
        action = 'duplicate';
        targetId = nextFreeId(sourceId, taken);
        taken.add(targetId);
        preparedCourse = {
          ...course,
          meta: {
            ...course.meta,
            id: targetId,
          },
        };
      }
    }

    plannedCourses.push({
      sourceId,
      targetId,
      action,
      conflict,
      course: preparedCourse,
      topicCount: course.topics.length,
    });
  }

  return {
    kind: archive.manifest.kind,
    courses: plannedCourses,
  };
}

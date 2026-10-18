import type { TopicContent, CourseDefinitionAPI } from '@core/courseDataLoader';
import type { LocalizedValue } from '@i18n/localizedValue';

type ViewType = 'hub' | 'course-home' | 'topic-view';
type Registry = Record<string, CourseDefinitionAPI>;
type CanvasContent = Extract<TopicContent, { type: 'canvas' }>;
type StepsContent = Extract<TopicContent, { type: 'steps' }>;

function formatLocalized(val?: LocalizedValue): string {
  if (!val) return '';
  if (typeof val === 'string') return val;
  const pairs = Object.entries(val).map(([language, text]) => `${language}: "${text ?? ''}"`);
  return `[${pairs.join(', ')}]`;
}

function viewTypeOf(activeTopicId?: string, activeCourseId?: string): ViewType {
  if (activeTopicId === 'home' || !activeCourseId) return 'hub';
  return activeTopicId === 'course-home' ? 'course-home' : 'topic-view';
}

function headerLines(viewType: ViewType, activeCourseId?: string, activeTopicId?: string): string[] {
  return [
    '=== LIVE APP CONTEXT (REAL-TIME STATE) ===',
    `View Type: ${viewType}`,
    `Active Course ID: ${activeCourseId || 'none'}`,
    `Active Topic ID: ${activeTopicId || 'none'}`,
  ];
}

type Week = CourseDefinitionAPI['catalog'][string];

function weekLines(weekKey: string, weekData: Week): string[] {
  const lectures = weekData.lectures ?? [];
  const practice = weekData.practice ?? [];
  const list = (items: typeof lectures) => items.map((t) => `${t.id} ("${formatLocalized(t.title)}")`).join(', ');
  const lines = [`  - Week "${weekKey}": ${formatLocalized(weekData.title)} (${lectures.length} lectures, ${practice.length} practice)`];
  if (lectures.length > 0) lines.push(`      Lectures: ${list(lectures)}`);
  if (practice.length > 0) lines.push(`      Practice: ${list(practice)}`);
  return lines;
}

function courseSection(courseDef: CourseDefinitionAPI): string[] {
  const weekKeys = Object.keys(courseDef.catalog || {});
  const lines = [
    '\n--- Course Information ---',
    `Course Name: ${formatLocalized(courseDef.title)}`,
    `Course Code: ${courseDef.code}`,
    `Description: ${formatLocalized(courseDef.description)}`,
    `Available Weeks (${weekKeys.length}): ${weekKeys.join(', ')}`,
  ];
  if (weekKeys.length > 0) {
    lines.push('Course Structure:');
    for (const wk of weekKeys) lines.push(...weekLines(wk, courseDef.catalog[wk]));
  }
  return lines;
}

function viewSection(viewType: ViewType, activeCourseId: string | undefined, registry: Registry): string[] {
  if (viewType === 'hub') {
    return [
      '\n--- User View ---',
      'User is on the Main Dashboard / Course Hub.',
      'Available Courses: ' + Object.keys(registry).join(', '),
      'Action Context: User can ask about courses, create new courses, or ask for explanations.',
    ];
  }
  if (viewType === 'course-home') {
    return [
      '\n--- User View ---',
      `User is looking at the syllabus for course "${activeCourseId}".`,
      'Action Context: User can add weeks, add lectures to weeks, or modify course structure.',
      'Default Target for "add lecture": First week is usually "week1" unless specified.',
    ];
  }
  return [];
}

type Block = NonNullable<CanvasContent['scene']['blocks']>[number];

function blockLines(block: Block): string[] {
  const blockTitle = block.title ? ` title=${formatLocalized(block.title)}` : '';
  const lines = [`  - [${block.kind}] id="${block.id}" pos=(${block.x}, ${block.y}) size=(${block.width}x${block.height})${blockTitle}`];
  if (block.kind === 'richText') lines.push(`      body: ${formatLocalized(block.body)}`);
  else if (block.kind === 'pdf' || block.kind === 'image' || block.kind === 'video') lines.push(`      src: ${block.src}`);
  else if (block.kind === 'youtube') lines.push(`      videoId: ${block.videoId}`);
  return lines;
}

function canvasLines(scene: CanvasContent['scene']): string[] {
  return [
    `Canvas Size: ${scene.canvasSize?.width ?? 1200}x${scene.canvasSize?.height ?? 800}`,
    `Blocks Count: ${scene.blocks?.length ?? 0}`,
    'Visible Elements/Blocks:',
    ...(scene.blocks ?? []).flatMap(blockLines),
  ];
}

function stepsLines(steps: StepsContent['steps']): string[] {
  return [
    `Steps Count: ${steps?.length ?? 0}`,
    'Interactive Steps:',
    ...(steps ?? []).map((step, idx) => {
      const title = step.title ? formatLocalized(step.title) : `Step ${idx + 1}`;
      const change = step.whatChanged ? ` (changed: ${formatLocalized(step.whatChanged)})` : '';
      const reason = step.why ? ` (why: ${formatLocalized(step.why)})` : '';
      return `  ${idx + 1}. ${title}${change}${reason}`;
    }),
  ];
}

function topicSection(topicContent: TopicContent): string[] {
  const lines = ['\n--- Active Topic Details ---', `Topic Title: ${formatLocalized(topicContent.title)}`, `Topic Type: ${topicContent.type}`];
  if (topicContent.type === 'canvas') lines.push(...canvasLines(topicContent.scene));
  else if (topicContent.type === 'steps') lines.push(...stepsLines(topicContent.steps));
  return lines;
}

interface AppContextParams {
  activeCourseId?: string;
  activeTopicId?: string;
  topicContent?: TopicContent | null;
  registry?: Record<string, CourseDefinitionAPI>;
  /** What the user has selected on the open canvas (see selectionSummary.ts); empty when nothing. */
  selection?: string;
}

/**
 * Serializes current app state, course, topic, and canvas/steps data into
 * a structured text context for the AI prompt / system message.
 */
export function serializeAppContext(params: AppContextParams): string {
  const { activeCourseId, activeTopicId, topicContent, registry: courseRegistry } = params;
  // Fall back to empty if no registry provided (backward compat for AI tools)
  const registry = courseRegistry ?? ({} as Record<string, CourseDefinitionAPI>);
  const viewType = viewTypeOf(activeTopicId, activeCourseId);

  const lines = headerLines(viewType, activeCourseId, activeTopicId);
  if (activeCourseId && registry[activeCourseId]) lines.push(...courseSection(registry[activeCourseId]));
  lines.push(...viewSection(viewType, activeCourseId, registry));

  if (topicContent) lines.push(...topicSection(topicContent));
  else lines.push('\nTopic Content: None currently loaded (navigating catalog).');

  if (params.selection) lines.push('\n--- User Selection ("this" / "it" / "this text box" means these) ---', params.selection);

  lines.push('==========================================');
  return lines.join('\n');
}

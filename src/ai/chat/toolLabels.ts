import { AI_TEXT } from '../../i18n/dictionary';
import type { LocalizedText } from '../../i18n/localizedValue';

/** Plain-language names for the tools, keyed by the part of the tool name after any `mcp__server__` prefix. */
const TOOL_LABELS: Record<string, LocalizedText> = {
  show_database_tables: AI_TEXT.toolReadSchema,
  read_course_database: AI_TEXT.toolQueryData,
  list_lectures: AI_TEXT.toolListTopics,
  list_courses: AI_TEXT.toolListCourses,
  apply_scene_ops: AI_TEXT.toolEditCanvas,
  create_custom_canvas: AI_TEXT.toolBuildCanvas,
  generate_uml_diagram: AI_TEXT.toolMakeDiagram,
  content_editor_course: AI_TEXT.toolEditCourse,
  content_editor_week: AI_TEXT.toolEditSection,
  content_editor_topic: AI_TEXT.toolEditTopic,
  content_editor_visual_lecture: AI_TEXT.toolPublishVisual,
  save_animated_lecture: AI_TEXT.toolPublishVisual,
  source_editor_edit: AI_TEXT.toolEditCode,
  save_lecture_content: AI_TEXT.toolWriteLecture,
  create_course: AI_TEXT.toolEditCourse,
  add_lecture_to_course_list: AI_TEXT.toolUpdateCatalog,
};

/** What to call a tool in front of the user. Unknown tools fall back to their name with spaces, never the raw `mcp__` id. */
export function toolLabel(toolName: string, val: (input?: unknown) => string): string {
  const base = toolName.split('__').pop() ?? toolName;
  const known = TOOL_LABELS[base];
  return known ? val(known) : base.replace(/_/g, ' ');
}

const TECHNICAL_PREFIXES = /^(Invalid scene state after operations: |Invalid block structure: |Op \d+: )+/;

/** A tool error without the server's internal prefixes, so the line reads as a reason rather than a stack position. */
export function plainReason(error: string): string {
  return error.replace(TECHNICAL_PREFIXES, '');
}

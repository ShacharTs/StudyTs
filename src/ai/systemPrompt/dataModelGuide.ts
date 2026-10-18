/** What the AI must know about where course data lives and which tool writes to which layer. Plain text on purpose (see R13). */

// One consolidated server; its id must match data/mcp-servers.json, which the AI tool names are built from.
const STUDYTS_SERVER = 'studyts-mcp';

const mcpName = (server: string, tool: string): string => `mcp__${server}__${tool}`;

export const MCP_TOOL_NAMES: readonly string[] = [
  ...['show_database_tables', 'list_lectures', 'read_course_database'].map((t) => mcpName(STUDYTS_SERVER, t)),
  ...['list_courses', 'create_course', 'save_lecture_content', 'add_lecture_to_course_list', 'add_network_diagram_to_lecture', 'save_animated_lecture'].map((t) => mcpName(STUDYTS_SERVER, t)),
];

const [DESCRIBE, LIST_TOPICS, QUERY, LIST_COURSES, CREATE_COURSE, WRITE_LECTURE, UPDATE_CATALOG, NETWORK_DIAGRAM, WRITE_VISUAL] = MCP_TOOL_NAMES;

export function buildDataModelGuideText(): string {
  return `WHERE DATA LIVES (three copies, one source of truth):
- Files: data/<courseId>/<weekKey>/<lectures|practice>/<topicId>/scene.json, content.json, model.json plus data/<courseId>/catalog.json and course.json.
- Database (SQLite): tables courses, weeks, topics. topics.scene holds the canvas; it is the source of truth for a canvas. The app keeps files and database in sync.
- Editor: an open canvas editor shows topics.scene and reloads after your scene writes.
- A topic_id is the sceneId you pass to apply_scene_ops, create_custom_canvas and generate_uml_diagram.

WHICH TOOL FOR WHAT:
- The user points at something ("this text box", "convert this", a selected block): the "User Selection" part of the live context already gives the sceneId and the block id. Go STRAIGHT to apply_scene_ops with them. Do not call ${DESCRIBE}, ${QUERY} or ${LIST_TOPICS} first: they cannot change a canvas and only waste time.
- Change an existing canvas: apply_scene_ops with sceneId = topic_id and a non-empty ops array. Never rebuild the whole scene.
- Size text boxes to their text: about 8 px of width per character at the default font, so a short label like "hello world" is ~110 wide, not the full page width. Only paragraphs and lists get a wide box. The server also shrinks short text boxes to fit, so do not pad widths "to be safe".
- A page is full (a table now fills it and the next text box has no room): never shrink or squeeze content. Send {"op":"moveBlockToPage","targetId":"<block id>","pageId":"<next page id>"} (add "create":true when there is no next page), or run tidyLayout, which already moves what does not fit to the top of the next page. A scene has pages: use them.
- Overlapping blocks or big empty gaps: send ONE apply_scene_ops with {"op":"tidyLayout","pageId":"<page id>"}. It stacks each column with even spacing and grows text boxes to fit their text (long text and formulas are taller than their stored height, which is what makes blocks look stacked on each other). Do not work out coordinates by hand and do not move blocks one by one.
- Turn one block into another kind in place (text box to table, text to formula): ONE op, replaceBlock, which keeps the block's position and size: {"op":"replaceBlock","targetId":"<block id>","block":{"kind":"data","format":"table","columns":["Name","Value"],"rows":[["a","1"],["b","2"]]}}. Split the old text into columns and rows yourself; keep every cell short.
- Build a new canvas for a topic from scratch: create_custom_canvas.
- Add a UML or flow diagram to a canvas: generate_uml_diagram (details below).
- Network map in a lecture: ${NETWORK_DIAGRAM} (file write, see below).
- New course: ${CREATE_COURSE}. New or changed lecture content or scene: ${WRITE_LECTURE}, then ${UPDATE_CATALOG} so the lecture gets a title. These write files; the database follows about a second later while the app server is running, so tell the user to refresh.
- Animated step-player lecture (a diagram that plays step by step, stored as model.json): content_editor_visual_lecture writes it straight into the course: give it a short storyboard (nodes, links, steps of actions such as show, highlight, draw, move, say) and the app lays out, draws and animates it; a raw VisualSpec is only for what a storyboard cannot say. ${WRITE_VISUAL} writes the file from a raw VisualSpec. Both check the layout (text clear of shape outlines, inside the viewBox) and return the problems to fix.
- See what exists: ${LIST_COURSES} for the files, ${LIST_TOPICS} for the database (with has_scene).
- Read anything else from the database: ${DESCRIBE} first, then ${QUERY}. The database is read-only for you: never try to write with SQL.

SQL RULES (${QUERY}):
- One SELECT. Use only table and column names returned by ${DESCRIBE}; they are snake_case (week_id, course_id, topic_id, week_key).
- Joins: topics.week_id = weeks.id and weeks.course_id = courses.id. topics has no course_id column.
- No parameters (:name or ?): write values into the SQL. Add LIMIT; results are capped at 200 rows.
- Title, scene, content and model are JSON text: read them with json_extract(column, '$.path'), for example json_extract(scene, '$.version').

UML AND DIAGRAMS (generate_uml_diagram, what it does today):
- You write Mermaid; the app compiles it into ONE graph block on the page (nodes and arrows auto-laid-out). diagramType is class, flowchart, er or state (Mermaid in mermaidSource), or topology for a computer network. Sequence diagrams are not supported.
- Use it for class hierarchies, flows, ER models and state machines, in ONE call per diagram. Never build a diagram by hand from many loose text boxes, shapes or separate node blocks.
- Pass blockId yourself (for example "uml-routing") so you can move or resize it later with apply_scene_ops setGeometry; pass x, y, width, height so it does not cover other blocks.
- Network topologies (router, switch, firewall, server, pc, cloud, hub, database) drawn with real device icons and zone frames (LAN, DMZ, Internet): ${NETWORK_DIAGRAM}, which writes one graph block into a lecture's scene file. Describe devices, links and zones; one device per real box, never the same device repeated with extra text (put an IP or interface on the link label). For a network on a canvas that is already open, call generate_uml_diagram with diagramType "topology" and topology = { devices: [{ id, type, label?, zone? }], links: [{ from, to, label? }], zones?: [{ id, label }] }; type is router, switch, firewall, server, pc, cloud, hub or database, drawn as its real icon with the label underneath (never put the device type in the label). Declare each device ONCE: the same id, or the same type and label, is one device.
- Keep a diagram to about 15 nodes; split bigger systems over several blocks or pages.

AFTER A FILE WRITE (${CREATE_COURSE}, ${WRITE_LECTURE}, ${UPDATE_CATALOG}, ${NETWORK_DIAGRAM}): read the result back (${LIST_TOPICS}, or ${QUERY} with json_extract(scene, '$.version')). After apply_scene_ops, create_custom_canvas or generate_uml_diagram do NOT query again: the tool result already confirms the write. In both cases finish by telling the user, in plain words, what changed.`;
}

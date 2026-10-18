import path from 'path';
import { pathToFileURL } from 'url';
import { BaseMcpServer, type McpToolDefinition } from './BaseMcpServer.js';
import { createCourseAuthorTools } from './courseAuthorTools.js';

const DATA_DIR = path.resolve(process.cwd(), 'data');

const LOCALIZED = { description: 'Plain string, or an object with an en text plus any other language codes', oneOf: [{ type: 'string' }, { type: 'object' }] };

export const COURSE_AUTHOR_TOOLS: McpToolDefinition[] = [
  {
    name: 'list_courses',
    description: 'Lists existing courses and, per week, the lecture ids already in each catalog.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'create_course',
    description: 'Creates data/<id>/course.json for a new course. Fails if the course exists.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Lowercase kebab-case course id, e.g. computer-networking' },
        title: { type: 'string' },
        code: { type: 'string', description: 'Course code, e.g. CS-305' },
        subtitle: { type: 'string' },
        description: { type: 'string' },
        icon: { type: 'string', description: 'lucide icon name' },
        color: { type: 'string' },
        accent: { type: 'string' },
        badge: { type: 'string' },
      },
      required: ['id', 'title'],
    },
  },
  {
    name: 'save_lecture_content',
    description:
      'Writes content.json (array of {title, concept, whatChanged, why}) and/or scene.json (canvas scene with id, blocks, pages) for one lecture. Both are validated before saving; the running server reseeds automatically. For a UML/flow/ER/state diagram in an existing canvas prefer the app tool generate_uml_diagram over hand-writing graph nodes here; to change one block of an open canvas use apply_scene_ops. A canvas page is A4 (794x1123): content that does not fit goes on the NEXT page in `pages`, never squeezed in; move a block there later with the app tool apply_scene_ops moveBlockToPage.',
    inputSchema: {
      type: 'object',
      properties: {
        courseId: { type: 'string' },
        weekKey: { type: 'string', description: 'e.g. week-1' },
        topicId: { type: 'string', description: 'Lecture folder id, lowercase kebab-case' },
        section: { type: 'string', enum: ['lectures', 'practice'], description: "Defaults to 'lectures'" },
        content: { type: 'array', items: { type: 'object' } },
        scene: { type: 'object' },
      },
      required: ['courseId', 'weekKey', 'topicId'],
    },
  },
  {
    name: 'add_lecture_to_course_list',
    description: 'Adds or replaces one lecture entry (id, title, description) in a course catalog.json. weekTitle is required when the week is new.',
    inputSchema: {
      type: 'object',
      properties: {
        courseId: { type: 'string' },
        weekKey: { type: 'string' },
        weekTitle: LOCALIZED,
        section: { type: 'string', enum: ['lectures', 'practice'] },
        lecture: {
          type: 'object',
          properties: { id: { type: 'string' }, title: LOCALIZED, description: LOCALIZED },
          required: ['id', 'title', 'description'],
        },
      },
      required: ['courseId', 'weekKey', 'lecture'],
    },
  },
  {
    name: 'save_animated_lecture',
    description:
      'Writes model.json for a step-player lecture: a VisualSpec {id, viewBox, elements, steps}. Element kinds: circle, ellipse, rect, path (absolute M/L commands), text, math (LaTeX label in a foreignObject), bubble (speech box). Colours are theme tokens such as var(--viz-blue), var(--accent-green), var(--accent). Each step has whatChanged, why and tweens [{targets, params, at?}]; params are numbers or strings (opacity, translateX, translateY, strokeDashoffset, duration, ease). Keep text boxes clear of shape outlines and lines and inside the viewBox; a step may show a bubble-N (all bubble-N share one slot, fade the old one out and the next in). The spec is validated and layout-checked before saving; fix the listed problems and call again.',
    inputSchema: {
      type: 'object',
      properties: {
        courseId: { type: 'string' },
        weekKey: { type: 'string' },
        topicId: { type: 'string', description: 'Lecture folder id' },
        section: { type: 'string', enum: ['lectures', 'practice'] },
        spec: { type: 'object', description: 'The VisualSpec' },
      },
      required: ['courseId', 'weekKey', 'topicId', 'spec'],
    },
  },
  {
    name: 'add_network_diagram_to_lecture',
    description:
      'Adds a network diagram to a lecture scene.json as ONE graph block, drawn with real device icons (router, switch, firewall, server, pc, cloud, hub, database) and optional zone frames (LAN, DMZ, Internet). Describe it as devices, links and zones; never repeat a device. The same id, or the same type and label, is one device, so put extra text (an IP, an interface) on the link label, not in a second device. It is appended under the existing blocks of the scene; a page is A4, so when the diagram does not fit, put it on a following page (add a page to `pages`) instead of shrinking it.',
    inputSchema: {
      type: 'object',
      properties: {
        courseId: { type: 'string' },
        weekKey: { type: 'string' },
        topicId: { type: 'string', description: 'Lecture folder id' },
        section: { type: 'string', enum: ['lectures', 'practice'] },
        topology: {
          type: 'object',
          properties: {
            devices: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string', description: 'Unique, e.g. r1' },
                  type: { type: 'string', enum: ['router', 'switch', 'firewall', 'server', 'pc', 'cloud', 'hub', 'database'] },
                  label: { type: 'string', description: 'Shown under the icon; defaults to id' },
                  zone: { type: 'string', description: 'Zone id this device sits in' },
                },
                required: ['id', 'type'],
              },
            },
            links: { type: 'array', items: { type: 'object', properties: { from: { type: 'string' }, to: { type: 'string' }, label: { type: 'string' } }, required: ['from', 'to'] } },
            zones: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, label: { type: 'string' } }, required: ['id'] } },
          },
          required: ['devices'],
        },
        blockId: { type: 'string' },
        x: { type: 'number' },
        y: { type: 'number' },
      },
      required: ['courseId', 'weekKey', 'topicId', 'topology'],
    },
  },
];

const tools = createCourseAuthorTools(DATA_DIR);

const HANDLERS: Record<string, (args: Record<string, unknown>) => Promise<unknown>> = {
  list_courses: () => tools.listCourses(),
  create_course: tools.createCourse,
  save_lecture_content: tools.writeLecture,
  save_animated_lecture: tools.writeVisualLecture,
  add_lecture_to_course_list: tools.updateCatalog,
  add_network_diagram_to_lecture: tools.addNetworkDiagram,
};

class CourseAuthorServer extends BaseMcpServer {
  protected readonly serverName = 'CourseAuthorServer';
  protected readonly serverVersion = '1.0.0';
  protected readonly tools = COURSE_AUTHOR_TOOLS;

  protected async handleToolCall(name: string, args: Record<string, unknown>): Promise<unknown> {
    const handler = HANDLERS[name];
    if (!handler) throw new Error(`Unknown tool '${name}'`);
    return handler(args);
  }
}

// Auto-start only when run directly; pathToFileURL matches import.meta.url on Windows too.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  new CourseAuthorServer().start();
}

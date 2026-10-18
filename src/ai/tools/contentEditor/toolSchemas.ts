import type { AiTool } from '@core/shared/aiTypes';

export const CONTENT_EDITOR_TOOLS: AiTool[] = [
  {
    type: 'function',
    function: {
      name: 'content_editor_course',
      description: 'Create, update, or delete a course in the curriculum catalog. All slugs and colors will be auto-normalized.',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['create', 'update', 'delete'],
            description: 'Action to perform on the course',
          },
          id: {
            type: 'string',
            description: 'Unique course ID/slug (e.g. "algorithms", "test-ai", "cs-101")',
          },
          course: {
            type: 'object',
            description: 'Course metadata (required on create/update)',
            properties: {
              code: { type: 'string' },
              title: {
                type: 'string',
                description: 'Course title',
              },
              subtitle: {
                type: 'string',
                description: 'Course subtitle',
              },
              description: {
                type: 'string',
                description: 'Course description',
              },
              badge: {
                type: 'string',
                description: 'Course badge label (e.g. "Advanced", "Intro")',
              },
              icon: { type: 'string', description: 'Lucide icon name in PascalCase (e.g., "Cpu", "Sparkles", "GitPullRequest")' },
              color: { type: 'string', description: 'Hex color (#rrggbb) or rgba() (e.g., "#06b6d4", "rgba(6, 182, 212, 0.15)")' },
            },
          },
        },
        required: ['action', 'id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'content_editor_week',
      description: 'Create, update, or delete a week/module within a course.',
      parameters: {
        type: 'object',
        properties: {
          courseId: { type: 'string', description: 'Target course ID' },
          weekKey: { type: 'string', description: 'Week key (e.g., "week1", "week-2", "intro-module")' },
          action: {
            type: 'string',
            enum: ['create', 'update', 'delete'],
            description: 'Action to perform on the week',
          },
          title: {
            type: 'string',
            description: 'Week / Module title',
          },
          cascade: {
            type: 'boolean',
            description: 'Allow deleting week even if it contains topics (default false)',
          },
        },
        required: ['courseId', 'weekKey', 'action'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'content_editor_topic',
      description: 'Create, update, delete or move (reorder) a lecture or practice topic in a week. Automatically creates the week if it does not exist yet. To fix the order, use action "move" instead of deleting and recreating.',
      parameters: {
        type: 'object',
        properties: {
          courseId: { type: 'string', description: 'Target course ID' },
          weekKey: { type: 'string', description: 'Target week key (e.g. "week1", "week-1")' },
          section: {
            type: 'string',
            enum: ['lectures', 'practice'],
            description: 'Catalog section',
          },
          action: {
            type: 'string',
            enum: ['create', 'update', 'delete', 'move'],
            description: 'Action to perform on the topic',
          },
          topic: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'Unique topic ID / slug (e.g., "turing-machine", "graph-coloring")' },
              direction: { type: 'string', enum: ['up', 'down'], description: 'move only: swap with the previous (up) or next (down) topic in the same section' },
              toIndex: { type: 'integer', description: 'move only: new 0-based position in the section (alternative to direction)' },
              title: {
                type: 'string',
                description: 'Topic title',
              },
              description: {
                type: 'string',
                description: 'Topic description',
              },
            },
            required: ['id'],
          },
        },
        required: ['courseId', 'weekKey', 'section', 'action'],
      },
    },
  },
];

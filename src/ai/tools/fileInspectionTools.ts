import type { AiTool } from '@core/shared/aiTypes';

export const FILE_INSPECTION_TOOLS: AiTool[] = [
  {
    type: 'function',
    function: {
      name: 'read_project_template',
      description: 'Get a correct, ready-to-copy CanvasBlock JSON example for a given block kind, to use as a starting point when calling create_custom_canvas.',
      parameters: {
        type: 'object',
        properties: {
          templateName: {
            type: 'string',
            enum: ['graph', 'automata', 'richText', 'stepPlayer'],
            description: 'Which block kind to get an example for',
          },
        },
        required: ['templateName'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'parse_study_material',
      description: 'Parse raw syllabus or study text (e.g. extracted from PDF) into structured topics and concepts.',
      parameters: {
        type: 'object',
        properties: {
          rawText: {
            type: 'string',
            description: 'Raw study material or syllabus text to parse',
          },
          targetCourseId: {
            type: 'string',
            description: 'Target course identifier',
          },
        },
        required: ['rawText'],
      },
    },
  },
];

const TEMPLATE_SNIPPETS: Record<string, string> = {
  graph: JSON.stringify({
    id: 'graph-1', kind: 'graph', x: 20, y: 20, width: 600, height: 400,
    state: {
      nodes: [{ id: 'n1', label: 'Start', x: 100, y: 100 }, { id: 'n2', label: 'End', x: 300, y: 100 }],
      edges: [{ id: 'e1', from: 'n1', to: 'n2', directed: true, label: 'weight 1' }],
    },
  }),
  automata: JSON.stringify({
    id: 'automata-1', kind: 'automata', x: 20, y: 20, width: 600, height: 300,
    state: {
      states: [{ id: 'q0', transitions: [{ read: '0', write: '1', move: 'R', next: 'q0' }, { read: '_', write: '_', move: 'L', next: 'q_accept' }] }],
      initialState: 'q0',
      acceptState: 'q_accept',
      rejectState: 'q_reject',
      initialTape: ['0', '1', '1', '0'],
    },
  }),
  richText: JSON.stringify({
    id: 'text-1', kind: 'richText', x: 20, y: 20, width: 400, height: 200, variant: 'text',
    body: 'Example markdown text with $LaTeX$ formulas',
  }),
  stepPlayer: JSON.stringify({
    id: 'steps-1', kind: 'stepPlayer', x: 20, y: 20, width: 500, height: 300,
    steps: [{
      state: {},
      title: 'Step 1',
      whatChanged: 'What changed in this step',
      why: 'Why this happened',
    }],
  }),
};

export async function executeFileInspectionTool(
  name: string,
  args: Record<string, unknown>
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  if (name === 'read_project_template') {
    const templateName = args.templateName as string;
    const snippet = TEMPLATE_SNIPPETS[templateName];
    if (!snippet) {
      return { success: false, error: `Template '${templateName}' not found.` };
    }
    return { success: true, data: { templateName, snippet } };
  }

  if (name === 'parse_study_material') {
    const rawText = (args.rawText as string) || '';
    if (!rawText.trim()) {
      return { success: false, error: 'rawText cannot be empty.' };
    }

    const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean);
    const keyTerms = lines.filter((l) => l.length < 80 && (l.includes(':') || l.startsWith('-') || l.startsWith('#')));

    return {
      success: true,
      data: {
        summary: `Parsed ${lines.length} lines of study material.`,
        suggestedTopics: keyTerms.slice(0, 10),
        targetCourseId: args.targetCourseId || 'general',
      },
    };
  }

  return { success: false, error: `Unknown tool: ${name}` };
}

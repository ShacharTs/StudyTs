import type { ToolExecutionResult } from '../../toolExecutionResult';
import { parseMermaid, type DiagramType } from '@core/importers/mermaid/parseMermaid';
import { layoutNodes } from '../../../core/importers/mermaid/compileToGraphState';
import { compileToGraphState } from '@core/importers/mermaid/compileToGraphState';
import type { CanvasBlock } from '@core/types/canvasScene';
import { validateBlocks } from '@core/validation/blocks';
import type { AiTool } from '@core/shared/aiTypes';
import { compileTopology } from '@core/canvasBlocks/compileTopology';
import { NETWORK_DEVICES } from '@core/canvasBlocks/networkDevices';
import type { GraphState } from '@core/types/graphTypes';

export const GENERATE_UML_DIAGRAM_TOOL: AiTool = {
  type: 'function',
  function: {
    name: 'generate_uml_diagram',
    description:
      `Author a diagram that is compiled into ONE positioned graph block. For a computer NETWORK (routers, switches, firewalls, servers, PCs, the Internet) use diagramType "topology" and pass "topology": { devices: [{ id, type, label?, zone? }], links: [{ from, to, label? }], zones?: [{ id, label }] } — type is one of ${NETWORK_DEVICES.join(', ')}; each device is drawn as its real icon with the label under it, zones become framed groups (LAN, DMZ, Internet). Declare every device ONCE: the same id (or the same type and label) is one device, so put extra text such as an IP or interface on the link label, never in a second copy of the device. For UML class, flowchart, ER or state diagrams use mermaidSource (Mermaid syntax). Sequence diagrams are not supported — use apply_scene_ops/create_custom_canvas for those or ask the user how to proceed.`,
    parameters: {
      type: 'object',
      properties: {
        sceneId: { type: 'string', description: 'Topic ID / scene ID to add the diagram to' },
        diagramType: { type: 'string', enum: ['class', 'flowchart', 'er', 'state', 'topology'] },
        topology: {
          type: 'object',
          description: 'Only for diagramType "topology".',
          properties: {
            devices: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, type: { type: 'string', enum: [...NETWORK_DEVICES] }, label: { type: 'string' }, zone: { type: 'string' } }, required: ['id', 'type'] } },
            links: { type: 'array', items: { type: 'object', properties: { from: { type: 'string' }, to: { type: 'string' }, label: { type: 'string' } }, required: ['from', 'to'] } },
            zones: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, label: { type: 'string' } }, required: ['id'] } },
          },
          required: ['devices'],
        },
        mermaidSource: {
          type: 'string',
          description:
            'Mermaid syntax for the chosen diagramType (not used for "topology"). For classDiagram: use <|-- for inheritance (child on the left, parent on the right, e.g. "Circle <|-- Shape" is WRONG — write "Shape <|-- Circle" meaning Circle inherits from Shape), *-- for composition, o-- for aggregation.',
        },
        blockId: { type: 'string', description: 'Optional explicit id for the new block' },
        x: { type: 'number' },
        y: { type: 'number' },
        width: { type: 'number' },
        height: { type: 'number' },
      },
      required: ['sceneId', 'diagramType'],
    },
  },
};

const MERMAID_TYPES: DiagramType[] = ['class', 'flowchart', 'er', 'state'];
const SUPPORTED_TYPES = [...MERMAID_TYPES, 'topology'];


/** The first problem with the tool arguments, or null when they are usable. */
function argumentError(sceneId: unknown, diagramType: string, mermaidSource: unknown): string | null {
  if (!sceneId || typeof sceneId !== 'string') return 'sceneId must be a string';
  if (!SUPPORTED_TYPES.includes(diagramType)) return `diagramType must be one of: ${SUPPORTED_TYPES.join(', ')}`;
  if (diagramType !== 'topology' && (!mermaidSource || typeof mermaidSource !== 'string')) return 'mermaidSource must be a non-empty string';
  return null;
}

/** Placement defaults: 40,40 at 600x400 unless the caller says otherwise. */
function graphBlock(args: Record<string, unknown>, state: GraphState, size = { width: 600, height: 400 }) {
  return {
    id: (args.blockId as string) || `uml-${Date.now()}`,
    kind: 'graph' as const,
    x: (args.x as number) ?? 40,
    y: (args.y as number) ?? 40,
    width: (args.width as number) ?? size.width,
    height: (args.height as number) ?? size.height,
    state,
  };
}

async function saveBlock(sceneId: string, block: object, fetchFn: typeof fetch): Promise<{ ok: true; version: unknown } | { ok: false; error: string }> {
  const res = await fetchFn('/api/canvas-editor/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sceneId, ops: [{ op: 'insertBlock', block }] }),
  });
  if (!res.ok) {
    const resJson = await res.json().catch(() => ({}));
    return { ok: false, error: resJson.error || `Canvas write returned HTTP ${res.status}` };
  }
  return { ok: true, version: (await res.json()).version };
}

interface CompiledDiagram {
  state: GraphState;
  size?: { width: number; height: number };
  /** What the model should know about how its input was changed (duplicate devices folded). */
  note?: string;
}

/** Mermaid text or a topology, compiled to graph state; the error is for the model to read and fix. */
function compileDiagram(args: Record<string, unknown>, diagramType: string): CompiledDiagram | { error: string } {
  if (diagramType === 'topology') {
    const compiled = compileTopology(args.topology);
    if ('error' in compiled) return { error: `Topology error: ${compiled.error}` };
    const note = compiled.merged.length > 0 ? ` Merged duplicates: ${compiled.merged.join('; ')}.` : undefined;
    return { state: compiled.state, size: { width: compiled.width, height: compiled.height }, note };
  }
  const parsed = parseMermaid(args.mermaidSource as string, diagramType as DiagramType);
  if ('error' in parsed) return { error: `Mermaid parse error: ${parsed.error}` };
  return { state: compileToGraphState(parsed, layoutNodes(parsed)) };
}

export async function executeGenerateUmlDiagram(args: Record<string, unknown>, fetchFn: typeof fetch): Promise<ToolExecutionResult> {
  const sceneId = args.sceneId as string;
  const diagramType = args.diagramType as string;

  const badArgs = argumentError(sceneId, diagramType, args.mermaidSource);
  if (badArgs) return { success: false, error: badArgs };

  const compiled = compileDiagram(args, diagramType);
  if ('error' in compiled) return { success: false, error: compiled.error };

  const block = graphBlock(args, compiled.state, compiled.size);
  const validationError = validateBlocks([block as CanvasBlock]);
  if (validationError) return { success: false, error: `Compiled diagram failed validation: ${validationError}` };

  try {
    const saved = await saveBlock(sceneId, block, fetchFn);
    if (!saved.ok) return { success: false, error: saved.error };
    return {
      success: true,
      data: { message: `Compiled and saved a ${diagramType} diagram with ${compiled.state.nodes.length} nodes to scene ${sceneId}.${compiled.note ?? ''}`, version: saved.version },
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

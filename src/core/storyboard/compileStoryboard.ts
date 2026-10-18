import type { BuilderBlock, BuilderShape, VisualSpec, VisualStepSpec } from '../types/visualSpec';
import { checkVisualSpec } from '../validation/visualSpec/visualSpecJson';
import type { Point } from '../geometry/geometryPrimitives';
import { finalizeBuilderSpec } from '../visualBuilder/builderFinalize';
import { setElementStyle, setElementText } from '../visualBuilder/builderEdits';
import { connectShapes } from '../visualBuilder/connectors';
import { DEFAULT_STAGE, parseViewBox, viewBoxOf } from '../shared/stageSize';
import { createStampedPackElements } from '../visualBuilder/diagramPacks/packObjectElements';
import { packObjectByRef } from '../visualBuilder/diagramPacks/stylePackRegistry';
import { createShapeElements, DEFAULT_VIEW_WIDTH } from '../visualBuilder/shapeCatalog';
import { actionBlocks } from './actionRecipes';
import type { Storyboard, StoryboardNode, StoryboardNodeShape, StoryboardStep } from './storyboard';
import { placeNodes } from './storyboardLayout';
import { checkStoryboard } from './storyboardValidation';

export interface StoryboardCompilation {
  spec: VisualSpec | null;
  problems: string[];
}

const DEFAULT_VIEWBOX = viewBoxOf(DEFAULT_STAGE);
const DASHED = '8 6';

const BUILDER_SHAPE: Record<StoryboardNodeShape, BuilderShape> = { circle: 'circle', box: 'box', ellipse: 'ellipse', label: 'text', note: 'note' };

// Where a node colour goes: a note takes it as its accent, a label as its text colour, a shape as fill and outline.
const colorPatch = (shape: StoryboardNodeShape, color: string): Record<string, string> => {
  if (shape === 'note') return { '--bubble-color': color };
  if (shape === 'label') return { color };
  return { fill: color, stroke: color };
};

function nodeElements(node: StoryboardNode, shape: StoryboardNodeShape, at: Point) {
  const object = packObjectByRef(node.pack);
  if (node.pack !== undefined && object) return createStampedPackElements(object, node.pack, node.id, at, DEFAULT_VIEW_WIDTH);
  return createShapeElements(BUILDER_SHAPE[shape], node.id, at);
}

function withNode(spec: VisualSpec, node: StoryboardNode, at: Point): VisualSpec {
  const shape = node.shape ?? 'circle';
  const placed = { ...spec, elements: [...spec.elements, ...nodeElements(node, shape, at)] };
  // An empty label means no label: a pack object whose artwork crosses its centre (an accepting state) stays unlabelled.
  const texted = node.label === '' ? placed : setElementText(placed, node.id, node.label ?? node.id);
  return node.color ? setElementStyle(texted, node.id, colorPatch(shape, node.color)) : texted;
}

function withLinks(spec: VisualSpec, storyboard: Storyboard): { spec: VisualSpec; linkIds: Map<string, string> } {
  const linkIds = new Map<string, string>();
  const linked = (storyboard.links ?? []).reduce((current, link) => {
    const joined = connectShapes(current, link.from, link.to, link.directed !== false);
    if (!joined) return current;
    linkIds.set(`${link.from}->${link.to}`, joined.id);
    return link.dashed ? setElementStyle(joined.spec, joined.id, { strokeDasharray: DASHED }) : joined.spec;
  }, spec);
  return { spec: linked, linkIds };
}

function stepBlocks(step: StoryboardStep, linkIds: Map<string, string>): BuilderBlock[] {
  const blocks = (step.actions ?? []).flatMap((action) => actionBlocks(action, linkIds));
  return step.say ? [...blocks, { action: 'say', text: step.say }] : blocks;
}

function compiledStep(step: StoryboardStep, index: number, linkIds: Map<string, string>): VisualStepSpec {
  const blocks = stepBlocks(step, linkIds);
  return {
    id: `step-${index + 1}`,
    whatChanged: step.title ?? `Step ${index + 1}`,
    why: step.why ?? '',
    tweens: step.raw ?? [],
    builder: step.together === false ? { blocks } : { blocks, together: true },
  };
}

// The overview step shows the first bubble before anything happens, so the storyboard's first step is a real change.
function overviewStep(storyboard: Storyboard): VisualStepSpec {
  const blocks = storyboard.intro ? [{ action: 'say' as const, text: storyboard.intro }] : [];
  return { id: 'start', whatChanged: 'Overview', why: '', tweens: [], builder: { blocks } };
}

function build(storyboard: Storyboard): VisualSpec {
  const viewBox = storyboard.viewBox ?? DEFAULT_VIEWBOX;
  const positions = placeNodes(storyboard.nodes, storyboard.layout ?? 'row', parseViewBox(viewBox));
  const nodes = storyboard.nodes.reduce<VisualSpec>(
    (spec, node) => withNode(spec, node, positions.get(node.id) as Point),
    { id: storyboard.id, viewBox, elements: [], steps: [overviewStep(storyboard)] },
  );
  const { spec, linkIds } = withLinks(nodes, storyboard);
  const steps = [...spec.steps, ...storyboard.steps.map((step, index) => compiledStep(step, index, linkIds))];
  return { ...finalizeBuilderSpec({ ...spec, steps }), source: storyboard };
}

// Storyboard (nodes, links, steps of actions) to the VisualSpec the player runs. Pure and deterministic; every problem
// names the step and action or the link it came from.
export function compileStoryboard(value: unknown): StoryboardCompilation {
  const checked = checkStoryboard(value);
  if (!checked.storyboard) return { spec: null, problems: checked.problems };
  const spec = build(checked.storyboard);
  const shape = checkVisualSpec(spec);
  return shape.problems.length > 0 ? { spec: null, problems: shape.problems } : { spec, problems: [] };
}

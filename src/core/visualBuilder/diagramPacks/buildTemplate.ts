import { val } from '../../../i18n/localizedValue';
import type { LinkRoute, VisualSpec } from '../../types/visualSpec';
import { DEFAULT_STAGE, parseViewBox, viewBoxOf } from '../../shared/stageSize';
import { COLOR_CHOICES } from '../builderColors';
import { resizeElement, setElementStyle, setElementText } from '../builderEdits';
import { elementBox } from '../builderGeometry';
import { finalizeBuilderSpec } from '../builderFinalize';
import { addBuilderStep, setStepFields } from '../builderSteps';
import { rerouteLinks, setLinkArrow, setLinkLabel } from '../connectors';
import { applyEffect } from '../effects';
import { addPackObjectAtStep, addShapeAt, connectShapesAtStep } from '../sceneEdits';
import { presetOfRef } from '../shapeCatalog';
import type { PackTemplateDef, PackTemplateLink } from './stylePackFormat';
import { listPacks } from './stylePackRegistry';

export interface ResolvedTemplate {
  // '<packId>/<templateId>', the id a gallery command carries.
  ref: string;
  packId: string;
  def: PackTemplateDef;
}

const BLANK: VisualSpec = {
  id: 'new-visual-spec',
  viewBox: viewBoxOf(DEFAULT_STAGE),
  elements: [],
  steps: [{ id: 'start', whatChanged: 'Start', why: '', tweens: [], builder: { blocks: [] } }],
};

// A link from an object to itself is drawn as a loop whatever the route says; `loop` on a link between two objects reads as a curve.
const ROUTE_OF: Record<NonNullable<PackTemplateLink['route']>, LinkRoute> = { straight: 'straight', elbow: 'elbow', curve: 'curve', loop: 'curve' };

// Maps an object key, or a 'from->to' pair for a link, to the id it got in the spec.
type IdMap = ReadonlyMap<string, string>;

interface Build {
  spec: VisualSpec;
  ids: IdMap;
}

export function listTemplates(): ResolvedTemplate[] {
  return listPacks().flatMap((pack) => (pack.templates ?? []).map((def) => ({ ref: `${pack.id}/${def.id}`, packId: pack.id, def })));
}

export function templateByRef(ref: string): ResolvedTemplate | undefined {
  return listTemplates().find((template) => template.ref === ref);
}

function withSteps(def: PackTemplateDef, lang: string): VisualSpec {
  const empty = def.steps.slice(1).reduce((spec) => addBuilderStep(spec), { ...BLANK, id: def.id });
  return def.steps.reduce((spec, step, index) => setStepFields(spec, index, { whatChanged: val(step.caption, lang), why: '', together: true }), empty);
}

function firstStepOf(def: PackTemplateDef): Map<string, number> {
  return new Map(def.steps.flatMap((step, index) => step.show.map((key): [string, number] => [key, index])));
}

function paint(spec: VisualSpec, id: string, name: string): VisualSpec {
  const choice = COLOR_CHOICES.find((candidate) => candidate.name.toLowerCase() === name);
  return choice ? setElementStyle(spec, id, { stroke: choice.value, fill: choice.value }) : spec;
}

function narrow(spec: VisualSpec, id: string, width: number): VisualSpec {
  const element = spec.elements.find((el) => el.id === id);
  if (!element) return spec;
  const box = elementBox(element);
  return resizeElement(spec, id, { x: box.x + (box.w - width) / 2, y: box.y, w: width, h: box.h });
}

function placeObjects(start: VisualSpec, def: PackTemplateDef, lang: string): Build {
  const stepOf = firstStepOf(def);
  const view = parseViewBox(start.viewBox);
  return def.objects.reduce<Build>(
    (build, object) => {
      const at = { x: Math.round(object.at.x * view.w), y: Math.round(object.at.y * view.h) };
      const step = stepOf.get(object.key) ?? 0;
      const shape = presetOfRef(object.ref);
      const added = shape ? addShapeAt(build.spec, step, shape, at) : addPackObjectAtStep(build.spec, step, object.ref, at);
      if (!added) throw new Error(`Template ${def.id}: object ${object.key} names unknown ref ${object.ref}`);
      const labelled = object.label ? setElementText(added.spec, added.id, val(object.label, lang)) : added.spec;
      const painted = object.color ? paint(labelled, added.id, object.color) : labelled;
      const spec = object.width ? narrow(painted, added.id, object.width * view.w) : painted;
      return { spec, ids: new Map([...build.ids, [object.key, added.id]]) };
    },
    { spec: start, ids: new Map() },
  );
}

// An arrow appears with the later of its two ends.
function placeLinks(build: Build, def: PackTemplateDef, lang: string): Build {
  const stepOf = firstStepOf(def);
  return def.links.reduce<Build>((current, link) => {
    const [from, to] = [current.ids.get(link.from), current.ids.get(link.to)];
    const step = Math.max(stepOf.get(link.from) ?? 0, stepOf.get(link.to) ?? 0);
    const added = from && to ? connectShapesAtStep(current.spec, step, from, to, { route: link.route && ROUTE_OF[link.route], fromPort: link.fromPort, toPort: link.toPort }) : null;
    if (!added) throw new Error(`Template ${def.id}: link ${link.from}->${link.to} could not be drawn`);
    const labelled = link.label ? setLinkLabel(added.spec, added.id, val(link.label, lang)) : added.spec;
    const spec = link.arrow === false ? setLinkArrow(labelled, added.id, false) : labelled;
    return { spec, ids: new Map([...current.ids, [`${link.from}->${link.to}`, added.id]]) };
  }, build);
}

function placeEffects(build: Build, def: PackTemplateDef): VisualSpec {
  return def.steps.reduce(
    (spec, step, index) =>
      step.effects.reduce((current, { effect, target }) => applyEffect(current, index, effect, build.ids.get(target) ?? target), spec),
    build.spec,
  );
}

// Only calls the editors the builder itself uses, so a template is exactly what a person could have drawn by hand.
export function buildTemplate(def: PackTemplateDef, lang: string): VisualSpec {
  const objects = placeObjects(withSteps(def, lang), def, lang);
  const linked = placeLinks(objects, def, lang);
  // Loops are drawn before the links beside them exist, so they are routed again once every link is in.
  return finalizeBuilderSpec(placeEffects({ ...linked, spec: rerouteLinks(linked.spec) }, def));
}

import { listPackObjects, packObjectByRef } from '../visualBuilder/diagramPacks/stylePackRegistry';
import { STORYBOARD_NODE_SHAPES, STORYBOARD_SAY_LIMIT, type Storyboard } from './storyboard';

export interface StoryboardCheck {
  storyboard: Storyboard | null;
  problems: string[];
}

type Raw = Record<string, unknown>;

const ID_PATTERN = /^[A-Za-z][A-Za-z0-9_-]*$/;
const NODE_ACTIONS = ['show', 'hide', 'highlight', 'dim'];

const isRecord = (value: unknown): value is Raw => typeof value === 'object' && value !== null && !Array.isArray(value);
const records = (value: unknown): Raw[] => (Array.isArray(value) ? value.filter(isRecord) : []);
const isNumber = (value: unknown): boolean => typeof value === 'number' && Number.isFinite(value);

const isKnownShape = (shape: unknown): boolean => (STORYBOARD_NODE_SHAPES as readonly unknown[]).includes(shape);

function packProblem(node: Raw, id: string): string[] {
  if (node.pack === undefined || packObjectByRef(String(node.pack)) !== undefined) return [];
  const valid = listPackObjects().map((entry) => entry.ref).join(', ');
  return [`node "${id}": unknown pack object "${String(node.pack)}"; valid refs: ${valid}`];
}

function nodeProblems(node: Raw, seen: Set<string>): string[] {
  const id = String(node.id ?? '');
  const checks: Array<[boolean, string]> = [
    [!ID_PATTERN.test(id), `node id "${id}" must start with a letter and use letters, digits, - or _`],
    [seen.has(id), `duplicate node id "${id}"`],
    [node.shape !== undefined && !isKnownShape(node.shape), `node "${id}": unknown shape "${String(node.shape)}"`],
    [isNumber(node.x) !== isNumber(node.y), `node "${id}": give both x and y, or neither`],
  ];
  seen.add(id);
  return [...checks.filter(([failed]) => failed).map(([, message]) => message), ...packProblem(node, id)];
}

function linkProblems(link: Raw, index: number, ids: Set<string>, joined: Map<string, boolean>): string[] {
  const from = String(link.from ?? '');
  const to = String(link.to ?? '');
  const label = `link ${index + 1}`;
  const unknown = [from, to].filter((id) => !ids.has(id)).map((id) => `${label}: unknown node "${id}"`);
  if (unknown.length > 0) return unknown;
  if (from === to) return [`${label}: "${from}" cannot link to itself`];
  if (joined.has(`${from}->${to}`)) return [`${label}: "${from}" to "${to}" is already linked`];
  joined.set(`${from}->${to}`, link.dashed === true);
  return [];
}

interface Known {
  ids: Set<string>;
  // Declared links by "from->to"; the value says whether the link is dashed.
  joined: Map<string, boolean>;
}

function nodeIdsProblems(action: Raw, known: Known): string[] {
  const ids = Array.isArray(action.ids) ? action.ids.map(String) : [];
  if (ids.length === 0) return ['ids must be a non-empty list'];
  return ids.filter((id) => !known.ids.has(id)).map((id) => `unknown node "${id}"`);
}

function drawProblems(action: Raw, known: Known): string[] {
  const refs = records(action.links);
  if (refs.length === 0) return ['links must be a non-empty list of {from, to}'];
  return refs.flatMap((ref) => {
    const key = `${String(ref.from)}->${String(ref.to)}`;
    if (!known.joined.has(key)) return [`no link from "${String(ref.from)}" to "${String(ref.to)}"`];
    // Drawing a line in uses the dash pattern, so a dashed link would lose its dashes.
    return known.joined.get(key) ? [`link "${String(ref.from)}" to "${String(ref.to)}" is dashed and cannot be drawn in`] : [];
  });
}

function moveProblems(action: Raw, known: Known): string[] {
  const problems = known.ids.has(String(action.id)) ? [] : [`unknown node "${String(action.id)}"`];
  const to = action.to;
  if (!isRecord(to) || !isNumber(to.x) || !isNumber(to.y)) problems.push('"to" needs numeric x and y');
  return problems;
}

const ACTION_CHECKS: Record<string, (action: Raw, known: Known) => string[]> = {
  ...Object.fromEntries(NODE_ACTIONS.map((name) => [name, nodeIdsProblems])),
  draw: drawProblems,
  move: moveProblems,
};

function actionProblems(action: Raw, where: string, known: Known): string[] {
  const name = String(action.do);
  const check = ACTION_CHECKS[name];
  if (!check) return [`${where}: unknown action "${name}"`];
  return check(action, known).map((problem) => `${where} (${name}): ${problem}`);
}

function stepProblems(step: Raw, index: number, known: Known): string[] {
  const label = `step ${index + 1}`;
  const problems: string[] = [];
  if (typeof step.say === 'string' && step.say.length > STORYBOARD_SAY_LIMIT) problems.push(`${label}: say text is longer than ${STORYBOARD_SAY_LIMIT} characters`);
  if (step.raw !== undefined && !Array.isArray(step.raw)) problems.push(`${label}: raw must be a list of tweens`);
  records(step.actions).forEach((action, actionIndex) => problems.push(...actionProblems(action, `${label}, action ${actionIndex + 1}`, known)));
  return problems;
}

function structureProblems(raw: Raw): string[] {
  const problems: string[] = [];
  if (records(raw.nodes).length === 0) problems.push('storyboard needs at least one node');
  if (records(raw.steps).length === 0) problems.push('storyboard needs at least one step');
  return problems;
}

// Checks an AI- or builder-written storyboard before it is compiled; every problem names its step, action or link.
export function checkStoryboard(value: unknown): StoryboardCheck {
  if (!isRecord(value)) return { storyboard: null, problems: ['storyboard must be an object'] };
  const seen = new Set<string>();
  const problems = [...structureProblems(value), ...records(value.nodes).flatMap((node) => nodeProblems(node, seen))];
  const known: Known = { ids: seen, joined: new Map() };
  records(value.links).forEach((link, index) => problems.push(...linkProblems(link, index, known.ids, known.joined)));
  records(value.steps).forEach((step, index) => problems.push(...stepProblems(step, index, known)));
  return { storyboard: problems.length === 0 ? (value as unknown as Storyboard) : null, problems };
}

import { DEVICE_SIZE_PX, NETWORK_DEVICES, isNetworkDevice, type NetworkDevice } from './networkDevices';
import type { GraphEdge, GraphNode, GraphState, GraphZone } from '../types/graphTypes';

/** A network drawn as devices, links and zones, instead of Mermaid text the model has to keep consistent. */
export interface Topology {
  devices: Array<{ id: string; type: string; label?: string; zone?: string }>;
  links?: Array<{ from: string; to: string; label?: string }>;
  zones?: Array<{ id: string; label?: string }>;
}

export interface CompiledTopology {
  state: GraphState;
  /** Size of the block that holds the whole layout. */
  width: number;
  height: number;
  /** One line per device that was folded into an earlier identical one. */
  merged: string[];
}

const COLUMN_MIN_WIDTH = 180;
const COLUMN_GAP = 24;
const ZONE_PAD = 24;
const ZONE_HEADER = 30;
const LABEL_HEIGHT = 26;
const ROW_GAP = 36;
const MAX_DEVICES = 40;

interface Device { id: string; type: NetworkDevice; label: string; zone?: string }

const slug = (value: string): string => value.trim().replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
const normalized = (label: string): string => label.trim().toLowerCase().replace(/\s+/g, ' ');

/** The first problem with the input, or null. Input comes from a model, so every field is checked. */
function inputError(input: unknown): string | null {
  const topology = input as Partial<Topology> | null;
  if (!topology || !Array.isArray(topology.devices) || topology.devices.length === 0) return 'topology.devices must be a non-empty array';
  if (topology.devices.length > MAX_DEVICES) return `topology.devices has ${topology.devices.length} entries; the limit is ${MAX_DEVICES}`;
  for (const device of topology.devices) {
    if (!device || typeof device.id !== 'string' || !slug(device.id)) return 'every device needs a string id';
    if (!isNetworkDevice(device.type)) return `device "${device.id}" has type "${device.type}"; use one of: ${NETWORK_DEVICES.join(', ')}`;
  }
  return null;
}

/**
 * One block per real device: the same id, or the same type and label, is the same device. Returns the unique devices,
 * a map from every id used in the input to its surviving id, and a note per folded duplicate.
 */
function dedupeDevices(raw: Topology['devices']) {
  const devices: Device[] = [];
  const idMap = new Map<string, string>();
  const byLabel = new Map<string, Device>();
  const merged: string[] = [];

  for (const entry of raw) {
    const id = slug(entry.id);
    const label = entry.label?.trim() || entry.id.trim();
    const sameId = devices.find((d) => d.id.toLowerCase() === id.toLowerCase());
    const sameLabel = byLabel.get(`${entry.type}|${normalized(label)}`);
    const existing = sameId ?? sameLabel;
    if (existing) {
      idMap.set(entry.id, existing.id);
      idMap.set(id, existing.id);
      merged.push(`"${entry.id}" is the same device as "${existing.id}"`);
      continue;
    }
    const device: Device = { id, label, type: entry.type as NetworkDevice, zone: entry.zone?.trim() || undefined };
    devices.push(device);
    byLabel.set(`${device.type}|${normalized(label)}`, device);
    idMap.set(entry.id, id);
    idMap.set(id, id);
  }
  return { devices, idMap, merged };
}

/** Links between surviving devices; an unknown endpoint is an error, repeats and self-links are dropped. */
function resolveLinks(links: NonNullable<Topology['links']>, idMap: Map<string, string>): GraphEdge[] | string {
  const edges: GraphEdge[] = [];
  const seen = new Set<string>();
  for (const link of links) {
    const from = idMap.get(String(link?.from));
    const to = idMap.get(String(link?.to));
    if (!from || !to) return `link ${String(link?.from)} -> ${String(link?.to)} names a device that is not in topology.devices`;
    const key = `${[from, to].sort().join('|')}|${link.label ?? ''}`;
    if (from === to || seen.has(key)) continue;
    seen.add(key);
    edges.push({ id: `link-${edges.length + 1}`, from, to, label: link.label, directed: false });
  }
  return edges;
}

interface Column { zone?: { id: string; label: string }; devices: Device[] }

/** One column per zone in the order given (then any zone only devices mention), loose devices last and unframed. */
function buildColumns(devices: Device[], zones: NonNullable<Topology['zones']>): Column[] {
  const order = new Map<string, string>();
  for (const zone of zones) if (zone?.id) order.set(zone.id, zone.label?.trim() || zone.id);
  for (const device of devices) if (device.zone && !order.has(device.zone)) order.set(device.zone, device.zone);
  const columns: Column[] = [...order].map(([id, label]) => ({ zone: { id, label }, devices: devices.filter((d) => d.zone === id) }));
  const loose = devices.filter((d) => !d.zone);
  return [...columns.filter((c) => c.devices.length > 0), ...(loose.length > 0 ? [{ devices: loose }] : [])];
}

const rowHeight = (device: Device): number => DEVICE_SIZE_PX[device.type].height + LABEL_HEIGHT + ROW_GAP;

function layoutColumns(columns: Column[]): { nodes: GraphNode[]; zones: GraphZone[]; width: number; height: number } {
  const contentHeight = Math.max(...columns.map((c) => c.devices.reduce((sum, d) => sum + rowHeight(d), 0)));
  const nodes: GraphNode[] = [];
  const zones: GraphZone[] = [];
  let left = 0;

  for (const column of columns) {
    const columnWidth = Math.max(COLUMN_MIN_WIDTH, ...column.devices.map((d) => DEVICE_SIZE_PX[d.type].width + 2 * ZONE_PAD));
    let top = ZONE_HEADER + ZONE_PAD;
    for (const device of column.devices) {
      const size = DEVICE_SIZE_PX[device.type];
      nodes.push({ id: device.id, label: device.label, device: device.type, x: Math.round(left + (columnWidth - size.width) / 2), y: top, width: size.width, height: size.height });
      top += rowHeight(device);
    }
    if (column.zone) zones.push({ id: column.zone.id, label: column.zone.label, x: left, y: 0, width: columnWidth, height: ZONE_HEADER + 2 * ZONE_PAD + contentHeight });
    left += columnWidth + COLUMN_GAP;
  }
  return { nodes, zones, width: left - COLUMN_GAP, height: ZONE_HEADER + 2 * ZONE_PAD + contentHeight };
}

export function compileTopology(input: unknown): CompiledTopology | { error: string } {
  const problem = inputError(input);
  if (problem) return { error: problem };
  const topology = input as Topology;

  const { devices, idMap, merged } = dedupeDevices(topology.devices);
  const edges = resolveLinks(topology.links ?? [], idMap);
  if (typeof edges === 'string') return { error: edges };

  const { nodes, zones, width, height } = layoutColumns(buildColumns(devices, topology.zones ?? []));
  return { state: { nodes, edges, ...(zones.length > 0 ? { zones } : {}) }, width, height, merged };
}

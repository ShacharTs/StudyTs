import type { ToolboxCategory, ToolboxItem } from '../toolboxTypes';
import type { ReactNode } from 'react';
import { spawnItem } from '../spawnItem';
import { PackIcon } from '../PackIcon';
import { PACK_BACKED_SHAPES } from '../../shapeEngine/packBackedShapes';

/** A palette entry that is an existing shape kind with a label, a default size and optional props. */
export interface Preset {
  id: string;
  label: string;
  shape: string;
  size: { w: number; h: number };
  text: string;
  tags?: string[];
  props?: Record<string, unknown>;
}

const STROKE = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.5 } as const;

/** One tiny outline per underlying shape kind; boundaries (dashed) get a dashed stroke. */
const GLYPHS: Record<string, (dashed: boolean) => ReactNode> = {
  hexagon: () => <path d="M7 4 L17 4 L21 12 L17 20 L7 20 L3 12 Z" {...STROKE} />,
  rounded: (dashed) => <rect x="3" y="6" width="18" height="12" rx="4" {...STROKE} strokeDasharray={dashed ? '3 2' : undefined} />,
  diamond: () => <path d="M12 3 L21 12 L12 21 L3 12 Z" {...STROKE} />,
  parallelogram: () => <path d="M7 6 H21 L17 18 H3 Z" {...STROKE} />,
  ellipse: () => <ellipse cx="12" cy="12" rx="9" ry="6" {...STROKE} />,
  rect: () => <rect x="3" y="6" width="18" height="12" {...STROKE} />,
};

function icon(shape: string, dashed: boolean): ReactNode {
  if (PACK_BACKED_SHAPES[shape]) return <PackIcon kind={shape} />;
  const glyph = GLYPHS[shape] ?? GLYPHS.rect;
  return <svg width="24" height="24" viewBox="0 0 24 24">{glyph(dashed)}</svg>;
}

export function presetItem(p: Preset): ToolboxItem {
  return {
    id: p.id,
    label: p.label,
    tags: p.tags,
    icon: icon(p.shape, p.props?.strokeStyle === 'dashed'),
    onSelect: (pageId) => spawnItem(pageId, 'shape', { shape: p.shape, label: p.text, ...p.props }, p.size),
  };
}

const SYSTEM_DESIGN_PRESETS: Preset[] = [
  { id: 'system-microservice', label: 'Microservice', shape: 'hexagon', size: { w: 44, h: 30 }, text: 'Service', tags: ['service', 'api'] },
  { id: 'system-api-gateway', label: 'API Gateway', shape: 'rounded', size: { w: 50, h: 24 }, text: 'API Gateway', tags: ['gateway', 'proxy'] },
  { id: 'system-load-balancer', label: 'Load Balancer', shape: 'diamond', size: { w: 40, h: 30 }, text: 'LB', tags: ['balancer', 'traffic'] },
  { id: 'system-cache', label: 'Cache (Redis)', shape: 'cylinder', size: { w: 22, h: 25 }, text: 'Redis', tags: ['redis', 'memory'] },
  { id: 'system-message-queue', label: 'Message Queue (Kafka)', shape: 'parallelogram', size: { w: 50, h: 22 }, text: 'Kafka', tags: ['kafka', 'broker', 'stream'] },
  {
    id: 'system-cloud-boundary', label: 'Cloud Boundary', shape: 'rounded', size: { w: 90, h: 60 }, text: 'Cloud',
    tags: ['region', 'vpc', 'boundary'], props: { strokeStyle: 'dashed' },
  },
  { id: 'system-storage-bucket', label: 'Storage Bucket (S3)', shape: 'cylinder', size: { w: 22, h: 25 }, text: 'S3', tags: ['s3', 'storage', 'object'] },
];

export const SystemDesignCategory: ToolboxCategory = {
  id: 'system-design',
  title: 'System Design & Cloud',
  items: SYSTEM_DESIGN_PRESETS.map(presetItem),
};

/** Device presets draw their label under the icon rather than over it. */
const BELOW = { labelPlacement: 'below' } as const;

const NETWORK_PRESETS: Preset[] = [
  { id: 'network-router', label: 'Router', shape: 'router', size: { w: 19, h: 19 }, text: 'Router', tags: ['gateway', 'routing'], props: BELOW },
  { id: 'network-switch', label: 'Switch', shape: 'switch', size: { w: 23, h: 11 }, text: 'Switch', tags: ['lan', 'layer2'], props: BELOW },
  { id: 'network-firewall', label: 'Firewall', shape: 'firewall', size: { w: 19, h: 15 }, text: 'Firewall', tags: ['security', 'acl'], props: BELOW },
  { id: 'network-server-blade', label: 'Server', shape: 'server', size: { w: 22, h: 25 }, text: 'Server', tags: ['rack', 'host', 'blade'], props: BELOW },
  { id: 'network-workstation', label: 'PC / Client', shape: 'pc', size: { w: 19, h: 17 }, text: 'PC', tags: ['pc', 'host', 'laptop', 'client'], props: BELOW },
  { id: 'network-cloud', label: 'Cloud / Internet', shape: 'cloud', size: { w: 24, h: 16 }, text: 'Internet', tags: ['internet', 'wan', 'cloud'], props: BELOW },
  { id: 'network-hub', label: 'Hub', shape: 'hub', size: { w: 25, h: 10 }, text: 'Hub', tags: ['layer1', 'repeater'], props: BELOW },
  {
    id: 'network-subnet-boundary', label: 'Subnet Boundary', shape: 'rounded', size: { w: 90, h: 60 }, text: 'Subnet',
    tags: ['vlan', 'cidr', 'boundary'], props: { strokeStyle: 'dashed' },
  },
];

export const NetworkCategory: ToolboxCategory = {
  id: 'network',
  title: 'Network Infrastructure',
  items: NETWORK_PRESETS.map(presetItem),
};

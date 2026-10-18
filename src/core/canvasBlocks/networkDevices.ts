/** The network devices a diagram can draw as real icons (not a generic box with a word in it). */
export const NETWORK_DEVICES = ['router', 'switch', 'firewall', 'server', 'pc', 'cloud', 'hub', 'database'] as const;

export type NetworkDevice = (typeof NETWORK_DEVICES)[number];

export const isNetworkDevice = (value: unknown): value is NetworkDevice =>
  typeof value === 'string' && (NETWORK_DEVICES as readonly string[]).includes(value);

/** The shape-registry id that draws a device; a database is the existing cylinder. */
export const deviceShapeId = (device: NetworkDevice): string => (device === 'database' ? 'cylinder' : device);

/** Icon box in canvas px (the device's label is drawn below it, outside this box). */
export const DEVICE_SIZE_PX: Record<NetworkDevice, { width: number; height: number }> = {
  router: { width: 72, height: 72 },
  switch: { width: 88, height: 40 },
  firewall: { width: 72, height: 56 },
  server: { width: 60, height: 72 },
  pc: { width: 72, height: 60 },
  cloud: { width: 104, height: 64 },
  hub: { width: 80, height: 36 },
  database: { width: 60, height: 68 },
};

/** Every id a `shape` block may use: the basic outlines plus the devices. */
export const SHAPE_BLOCK_SHAPES: readonly string[] = ['circle', 'rect', 'diamond', ...NETWORK_DEVICES];

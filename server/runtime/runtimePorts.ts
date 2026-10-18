import { readFileSync } from 'node:fs';
import path from 'node:path';

export interface RuntimePorts {
  frontendPort: number;
  apiPort: number;
  loopbackHost: string;
}

const PORT_KEYS = ['frontendPort', 'apiPort'] as const;

export function parseRuntimePorts(raw: string): RuntimePorts {
  let parsed: Partial<RuntimePorts>;
  try {
    parsed = JSON.parse(raw) as Partial<RuntimePorts>;
  } catch (err) {
    throw new Error(`config/runtimePorts.json is not valid JSON: ${(err as Error).message}`);
  }

  for (const key of PORT_KEYS) {
    const value = parsed[key];
    if (!Number.isInteger(value) || (value as number) < 1 || (value as number) > 65535) {
      throw new Error(`runtimePorts.${key} must be an integer between 1 and 65535`);
    }
  }

  const ports = PORT_KEYS.map((k) => parsed[k]);
  if (new Set(ports).size !== ports.length) {
    throw new Error('runtimePorts has duplicate ports');
  }

  if (typeof parsed.loopbackHost !== 'string' || parsed.loopbackHost === '') {
    throw new Error('runtimePorts.loopbackHost must be a non-empty string');
  }

  return parsed as RuntimePorts;
}

export function readRuntimePorts(): RuntimePorts {
  return parseRuntimePorts(readFileSync(path.resolve(process.cwd(), 'config', 'runtimePorts.json'), 'utf8'));
}

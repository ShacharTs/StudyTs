import { readRuntimePorts } from '../runtime/runtimePorts.js';

export const DEV_CLIENT_PORT = 7300;
export const LOOPBACK_HOST = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

export function getDefaultOrigins(): string {
  try {
    const { frontendPort, loopbackHost } = readRuntimePorts();
    return `http://localhost:${frontendPort},http://${loopbackHost}:${frontendPort}`;
  } catch {
    return `http://localhost:${DEV_CLIENT_PORT},http://127.0.0.1:${DEV_CLIENT_PORT}`;
  }
}

export function isSameOrigin(origin: string, host: string | undefined): boolean {
  if (!host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

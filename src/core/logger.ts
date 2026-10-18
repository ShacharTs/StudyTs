import { redact } from '@core/shared/redact';
export { redact };

type Level = 'debug' | 'info' | 'warn' | 'error';

function output(level: Level, msg: string, fields?: Record<string, unknown>): void {
  if (level !== 'error' && !import.meta.env.DEV) return;
  const payload = {
    ts: new Date().toISOString(),
    level,
    msg,
    ...(fields ? (redact(fields) as Record<string, unknown>) : {}),
  };
  const json = JSON.stringify(payload);
  if (level === 'error') {
    console.error(json);
  } else if (level === 'warn') {
    console.warn(json);
  } else if (level === 'debug') {
    console.debug(json);
  } else {
    console.log(json);
  }
}

export const log = {
  debug: (msg: string, fields?: Record<string, unknown>) => output('debug', msg, fields),
  info: (msg: string, fields?: Record<string, unknown>) => output('info', msg, fields),
  warn: (msg: string, fields?: Record<string, unknown>) => output('warn', msg, fields),
  error: (msg: string, fields?: Record<string, unknown>) => output('error', msg, fields),
};

import { API_PATHS } from './shared/apiPaths';

export type ClientErrorSource = 'window.onerror' | 'unhandledrejection' | 'error-boundary';

export interface ClientErrorReport {
  message: string;
  source: ClientErrorSource;
  stack?: string;
  componentStack?: string;
  url?: string;
}

const CLIENT_ERROR_ENDPOINT = API_PATHS.clientErrors;
const MAX_REPORTS_PER_SESSION = 50;
const DEDUPE_WINDOW_MS = 5_000;

let sent = 0;
const recent = new Map<string, number>();

export function resetClientErrorReporterForTests(): void {
  sent = 0;
  recent.clear();
}

function isDuplicate(report: ClientErrorReport, now: number): boolean {
  const key = `${report.message}\n${report.stack ?? ''}`;
  const last = recent.get(key);
  recent.set(key, now);
  return last !== undefined && now - last < DEDUPE_WINDOW_MS;
}

function transport(body: string): void {
  const blob = new Blob([body], { type: 'application/json' });
  if (navigator.sendBeacon?.(CLIENT_ERROR_ENDPOINT, blob)) return;
  void fetch(CLIENT_ERROR_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => undefined);
}

// Fire-and-forget; never throws or reports own failure to avoid infinite error loops.
export function reportClientError(report: ClientErrorReport): void {
  try {
    if (sent >= MAX_REPORTS_PER_SESSION || isDuplicate(report, Date.now())) return;
    sent += 1;
    transport(JSON.stringify({ ...report, url: report.url ?? location.href }));
  } catch {
    // Intentional: reporting is best-effort and failures must not crash the client
  }
}

function textOf(reason: unknown): { message: string; stack?: string } {
  return reason instanceof Error
    ? { message: reason.message, stack: reason.stack }
    : { message: String(reason) };
}

export function installGlobalErrorReporting(
  target: Pick<Window, 'addEventListener' | 'removeEventListener'> = window
): () => void {
  const onError = (event: ErrorEvent) =>
    reportClientError({
      source: 'window.onerror',
      ...(event.error ? textOf(event.error) : { message: event.message }),
    });
  const onRejection = (event: PromiseRejectionEvent) =>
    reportClientError({ source: 'unhandledrejection', ...textOf(event.reason) });
  target.addEventListener('error', onError as EventListener);
  target.addEventListener('unhandledrejection', onRejection as EventListener);
  return () => {
    target.removeEventListener('error', onError as EventListener);
    target.removeEventListener('unhandledrejection', onRejection as EventListener);
  };
}

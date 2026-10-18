export function isLogsRoute(pathname: string, search: string = ''): boolean {
  const cleanPath = pathname.replace(/^\/+|\/+$/g, '');
  if (cleanPath === 'logs' || cleanPath.startsWith('logs/')) return true;
  const params = new URLSearchParams(search);
  return params.get('popout') === 'logs';
}

/** The only place API versions are pinned. Bump together with LAST_VERIFIED after reading the changelog. */
export const API_VERSIONS = {
  anthropic: { version: '2023-06-01', headerName: 'anthropic-version', changelogUrl: 'https://docs.anthropic.com/en/api/versioning' },
  gemini: { version: 'v1beta', basePath: 'v1beta', changelogUrl: 'https://ai.google.dev/gemini-api/docs/changelog' },
  openAiCompatible: { version: 'v1', changelogUrl: 'https://platform.openai.com/docs/changelog' },
} as const;

export const LAST_VERIFIED = '2026-10-07';
export const MAX_VERSION_AGE_DAYS = 90;

const MS_PER_DAY = 86_400_000;

export function isVersionPinStale(now: Date): boolean {
  return (now.getTime() - new Date(LAST_VERIFIED).getTime()) / MS_PER_DAY > MAX_VERSION_AGE_DAYS;
}

// src/core/shared/appViewContext.ts
export const APP_VIEW_KINDS = [
  'hub',
  'courseHome',
  'courseViewer',
  'canvas',
  'stepPlayer',
  'visualAuthoring',
] as const;

export type AppViewKind = (typeof APP_VIEW_KINDS)[number];

export type AppViewContext =
  | { kind: 'hub' }
  | { kind: 'courseHome'; courseId: string }
  | { kind: 'courseViewer'; courseId: string; topicId: string }
  | { kind: 'canvas'; sceneId: string; pageId?: string; selectedCount: number }
  | { kind: 'stepPlayer'; specId: string; stepIndex: number; totalSteps: number }
  | { kind: 'visualAuthoring'; specId: string };

const VALIDATORS: Record<AppViewKind, (obj: Record<string, unknown>) => boolean> = {
  hub: () => true,
  courseHome: (o) => typeof o.courseId === 'string' && o.courseId.length > 0,
  courseViewer: (o) => typeof o.courseId === 'string' && typeof o.topicId === 'string',
  canvas: (o) => typeof o.sceneId === 'string' && typeof o.selectedCount === 'number',
  stepPlayer: (o) =>
    typeof o.specId === 'string' &&
    typeof o.stepIndex === 'number' &&
    Number.isInteger(o.stepIndex) &&
    typeof o.totalSteps === 'number',
  visualAuthoring: (o) => typeof o.specId === 'string',
};

export function isAppViewContext(value: unknown): value is AppViewContext {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  const validator = typeof obj.kind === 'string' ? VALIDATORS[obj.kind as AppViewKind] : undefined;
  return validator ? validator(obj) : false;
}

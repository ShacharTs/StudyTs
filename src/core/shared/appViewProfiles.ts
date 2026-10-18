// src/core/shared/appViewProfiles.ts
import type { AppViewKind } from './appViewContext';

export interface AppViewProfile {
  guidance: string;
  excludedToolNames: readonly string[];
}

export const APP_VIEW_PROFILES: Record<AppViewKind, AppViewProfile> = {
  canvas: {
    guidance: 'The user is editing a canvas document. Prefer apply_scene_ops on selected block ids over rebuilding the entire scene.',
    excludedToolNames: ['content_editor_course', 'content_editor_week'],
  },
  stepPlayer: {
    guidance: 'The user is viewing an interactive step player visualization.',
    excludedToolNames: ['apply_scene_ops', 'create_custom_canvas', 'generate_uml_diagram'],
  },
  visualAuthoring: {
    guidance: 'The user is editing a visual step spec.',
    excludedToolNames: ['apply_scene_ops', 'create_custom_canvas', 'generate_uml_diagram'],
  },
  hub: {
    guidance: 'The user is on the main course hub.',
    excludedToolNames: ['apply_scene_ops', 'create_custom_canvas'],
  },
  courseHome: {
    guidance: 'The user is on the course overview dashboard.',
    excludedToolNames: ['apply_scene_ops', 'create_custom_canvas'],
  },
  courseViewer: {
    guidance: 'The user is reading course topic content.',
    excludedToolNames: [],
  },
};

export function filterToolsForView<T extends { function: { name: string } }>(
  tools: T[],
  kind?: AppViewKind | null
): T[] {
  if (!kind || !APP_VIEW_PROFILES[kind]) return tools;
  const excluded = new Set(APP_VIEW_PROFILES[kind].excludedToolNames);
  return tools.filter((tool) => !excluded.has(tool.function.name));
}

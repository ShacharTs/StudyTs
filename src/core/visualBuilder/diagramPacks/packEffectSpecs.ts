import type { BuilderBlockParams, VisualTweenSpec } from '../../types/visualSpec';
import type { EffectSpec } from '../effectSpec';
import { PACK_ANIME_RANGES, type PackEffectDef } from './stylePackFormat';
import { listPacks } from './stylePackRegistry';

const EASE_NAMES: Record<string, string> = {
  linear: 'linear',
  easeInQuad: 'inQuad',
  easeOutQuad: 'outQuad',
  easeInOutQuad: 'inOutQuad',
  easeInOutSine: 'inOutSine',
};
const DEFAULT_EASE = 'outQuad';

const refOf = (packId: string, effect: PackEffectDef): string => `${packId}/${effect.id}`;

export function packEffects(): EffectSpec[] {
  return listPacks().flatMap((pack) =>
    (pack.effects ?? []).map((effect) => ({
      id: refOf(pack.id, effect),
      label: effect.label.en,
      description: effect.description.en,
      kinds: effect.kinds,
      duration: effect.duration,
      icon: effect.icon,
      tone: effect.tone,
      action: 'pack' as const,
      anime: effect.anime,
      source: pack.id,
    })),
  );
}

export function packEffectByRef(ref: string | undefined): EffectSpec | undefined {
  return packEffects().find((effect) => effect.id === ref);
}

const PROPS = Object.keys(PACK_ANIME_RANGES) as Array<keyof typeof PACK_ANIME_RANGES>;

// The first keyframe is the resting state, so each later one is a segment that tweens to that value.
export function animeToTweens(anime: BuilderBlockParams, targets: string[], at: number, duration: number): VisualTweenSpec[] {
  const tracks = PROPS.flatMap((prop) => (anime[prop] && anime[prop].length >= 2 ? [[prop, anime[prop]] as const] : []));
  const segments = Math.max(0, ...tracks.map(([, values]) => values.length - 1));
  const slice = Math.max(1, Math.round(duration / Math.max(1, segments)));
  const ease = EASE_NAMES[anime.easing ?? ''] ?? DEFAULT_EASE;
  return Array.from({ length: segments }, (_, segment) => {
    const params = Object.fromEntries(tracks.map(([prop, values]) => [prop, values[Math.round(((segment + 1) * (values.length - 1)) / segments)]]));
    return {
      targets: targets.length === 1 ? targets[0] : targets,
      params: { ...params, duration: slice, ease },
      at: at + segment * slice,
      builder: { generated: true as const },
    };
  });
}

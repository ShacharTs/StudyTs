import type { BuilderBlockAction, BuilderBlockParams } from '../types/visualSpec';
import type { EffectTone, ObjectKind } from './objectKinds';

// Block fields the gallery cannot ask for; a Move destination is computed from the shape it lands on.
export interface EffectDefaults {
  text?: string;
  color?: string;
  moveDy?: number;
}

export interface EffectSpec {
  id: string;
  label: string;
  description: string;
  kinds: readonly ObjectKind[];
  duration: number;
  icon: string;
  tone: EffectTone;
  action: BuilderBlockAction;
  defaults?: EffectDefaults;
  // Keyframes of a pack effect; core effects have a dedicated tween maker instead.
  anime?: BuilderBlockParams;
  // 'core' or the id of the pack that declares the effect.
  source: string;
}

import type { VisualSpec } from '@core/types/visualSpec';
import { updateBlock } from '@core/visualBuilder/blocks';
import type { ModeEffect } from '@core/visualBuilder/builderMode';
import { applyEffect, type EffectId } from '@core/visualBuilder/effects';
import { newLinkArrow } from '@core/visualBuilder/modeTools/linkStyle';
import { labelNewTransition } from '@core/visualBuilder/modeTools/transitionLabels';
import { setLinkArrow } from '@core/visualBuilder/connectors';
import { walkPath } from '@core/visualBuilder/recipes';
import { addShapeAt, connectShapesAtStep } from '@core/visualBuilder/sceneEdits';
import type { useVisualBuilder } from './useVisualBuilder';

type Builder = ReturnType<typeof useVisualBuilder>;
type EffectRunners = { [K in ModeEffect['type']]: (effect: Extract<ModeEffect, { type: K }>) => void };

// What a finished interaction (connect, quick add, walk, pick) does to the spec.
export function useModeEffects(spec: VisualSpec, b: Builder, labelCycle: string[] = [], configuredArrow = true, lang = 'en'): (effect: ModeEffect) => void {
  const runners: EffectRunners = {
    connect: (effect) => {
      const linked = connectShapesAtStep(spec, b.stepIndex, effect.from, effect.to, { fromPort: effect.fromPort, toPort: effect.toPort });
      if (!linked) return;
      const arrow = newLinkArrow(spec, configuredArrow);
      const styled = arrow ? linked.spec : setLinkArrow(linked.spec, linked.id, false);
      b.commit(labelNewTransition(styled, linked.id, labelCycle));
      b.select(linked.id);
    },
    connectNew: (effect) => {
      const added = addShapeAt(spec, b.stepIndex, effect.shape, effect.at);
      const linked = connectShapesAtStep(added.spec, b.stepIndex, effect.from, added.id, { fromPort: effect.fromPort });
      b.commit(linked?.spec ?? added.spec);
      b.select(added.id);
    },
    finishWalk: (effect) => {
      b.commit(walkPath(spec, effect.path, lang));
      b.setStepIndex(spec.steps.length);
    },
    setSpot: (effect) => {
      const to = { x: Math.round(effect.point.x), y: Math.round(effect.point.y) };
      b.commit(updateBlock(spec, effect.stepIndex, effect.blockIndex, { to }));
    },
    applyEffect: (effect) => b.commit(applyEffect(spec, b.stepIndex, effect.effect as EffectId, effect.target)),
  };

  return (effect) => (runners[effect.type] as (effect: ModeEffect) => void)(effect);
}

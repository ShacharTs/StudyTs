import type { PipelineModel, PipelineStage } from './pipelineModel';
import type { PipelineSpec } from './pipelineSpec';

export type PipelineEvent =
  | { type: 'tick'; number: number; stages: { stage: string; held: number }[]; stalled: string[] }
  | { type: 'verdict'; done: number; ticks: number; bottleneck: string | null };

export type PipelineTrace = PipelineEvent[];

// Back to front: each stage hands on what it held at the start of the tick, so an item moves at most one stage per tick
// and the room a downstream stage frees is usable upstream in the same tick.
function advance(stages: PipelineStage[], held: number[]): { stalledAt: number[]; exited: number } {
  const stalledAt: number[] = [];
  const last = stages.length - 1;
  const exited = held[last];
  held[last] = 0;
  for (let index = last - 1; index >= 0; index -= 1) {
    const moved = Math.min(held[index], stages[index + 1].capacity - held[index + 1]);
    held[index] -= moved;
    held[index + 1] += moved;
    if (held[index] > 0) stalledAt.unshift(index);
  }
  return { stalledAt, exited };
}

function bottleneckOf(stages: PipelineStage[], stalls: number[]): string | null {
  let worst = 0;
  let index = -1;
  stalls.forEach((count, position) => {
    if (count > worst) {
      worst = count;
      index = position;
    }
  });
  // A stall is felt upstream but caused by the stage that would not take the items, so the next stage is named.
  return index === -1 ? null : stages[Math.min(index + 1, stages.length - 1)].id;
}

// Pure tick simulation: one item enters the first stage per tick while it has room, then every stage hands on as many
// items as the next stage can take. Stops when every item has left or the tick cap is reached.
export function runPipeline(model: PipelineModel, spec: PipelineSpec): PipelineTrace {
  if (!model.ok || model.stages.length === 0) return [];
  const { stages } = model;
  const held = stages.map(() => 0);
  const stalls = stages.map(() => 0);
  const trace: PipelineTrace = [];
  let remaining = spec.tokens;
  let done = 0;
  let tick = 0;
  while (done < spec.tokens && tick < spec.ticks) {
    tick += 1;
    const entering = Math.min(remaining, stages[0].capacity - held[0]);
    remaining -= entering;
    held[0] += entering;
    const { stalledAt, exited } = advance(stages, held);
    done += exited;
    stalledAt.forEach((index) => {
      stalls[index] += 1;
    });
    trace.push({
      type: 'tick',
      number: tick,
      stages: stages.map((stage, index) => ({ stage: stage.id, held: held[index] })),
      stalled: stalledAt.map((index) => stages[index].id),
    });
  }
  trace.push({ type: 'verdict', done, ticks: tick, bottleneck: bottleneckOf(stages, stalls) });
  return trace;
}

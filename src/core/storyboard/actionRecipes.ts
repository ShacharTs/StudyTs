import type { BuilderBlock } from '../types/visualSpec';
import type { StoryboardAction } from './storyboard';

type Recipe<A extends StoryboardAction> = (action: A, linkIds: Map<string, string>) => BuilderBlock[];

const block = (action: BuilderBlock['action'], target: string, extra: Partial<BuilderBlock> = {}): BuilderBlock => ({ action, target, ...extra, speed: 'normal' });

const nodeRecipe: Recipe<Extract<StoryboardAction, { do: 'show' | 'hide' | 'highlight' | 'dim' }>> = (action) => action.ids.map((id) => block(action.do, id));

const drawRecipe: Recipe<Extract<StoryboardAction, { do: 'draw' }>> = (action, linkIds) =>
  action.links.flatMap((ref) => {
    const id = linkIds.get(`${ref.from}->${ref.to}`);
    return id ? [block('draw', id)] : [];
  });

const moveRecipe: Recipe<Extract<StoryboardAction, { do: 'move' }>> = (action) => [block('move', action.id, { to: action.to })];

// One storyboard action becomes the builder blocks that already know how to animate it.
export function actionBlocks(action: StoryboardAction, linkIds: Map<string, string>): BuilderBlock[] {
  if (action.do === 'draw') return drawRecipe(action, linkIds);
  if (action.do === 'move') return moveRecipe(action, linkIds);
  return nodeRecipe(action, linkIds);
}

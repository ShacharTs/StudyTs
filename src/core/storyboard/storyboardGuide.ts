import { listCategories } from '../visualBuilder/diagramPacks/categoryRegistry';
import { COLOR_CHOICES } from '../visualBuilder/builderColors';
import { STORYBOARD_LAYOUTS, STORYBOARD_NODE_SHAPES, STORYBOARD_SAY_LIMIT } from './storyboard';

const shapes = STORYBOARD_NODE_SHAPES.join('|');
const layouts = STORYBOARD_LAYOUTS.join('|');

/**
 * The storyboard format in words, shared by the in-app AI tool and the MCP tool so both teach the same thing.
 * Built from the live constants and registries, so it cannot drift from what the compiler accepts.
 */
export function storyboardSyntax(): string {
  const categories = listCategories().map((category) => category.id).join(', ');
  const colors = COLOR_CHOICES.map((color) => color.value).join(', ');
  return (
    `{id, layout: ${layouts}, intro?, nodes: [{id, label?, shape?: ${shapes}, pack?: <packId>/<objectId>, color?: token, x?, y?}], ` +
    'links?: [{from, to, directed?, dashed?}], steps: [{title?, say?, together?, actions: [...]}]}. Actions: ' +
    '{do: show|hide|highlight|dim, ids: [...]}, {do: draw, links: [{from, to}]} (not for dashed links), {do: move, id, to: {x, y}}. ' +
    'A node with pack draws a style-pack object (for example an accepting state) instead of shape (an empty label draws none; leave an accepting state unlabelled); pack categories: ' + categories + '. ' +
    'An unknown ref is rejected with the list of valid refs. ' +
    `The app lays the nodes out, draws the arrows, writes the animation and the speech bubbles (say text is at most ${STORYBOARD_SAY_LIMIT} characters per step). ` +
    `Colour tokens: ${colors}.`
  );
}

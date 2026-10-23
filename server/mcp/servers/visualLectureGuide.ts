import { storyboardSyntax } from '../../../src/core/storyboard/storyboardGuide.js';

/**
 * What the model reads before it calls save_animated_lecture. The syntax comes from the app's own
 * registries; the rules say how to use them so the saved lecture stays editable in the step maker.
 */
export function visualLectureDescription(): string {
  return [
    'Writes model.json for a step-player lecture, an animated diagram that plays step by step. Pass a STORYBOARD (preferred): the app lays the nodes out, draws the arrows and writes the animation with the same blocks, shapes and effects the step maker uses, so the user can open the lecture and edit it by hand afterwards.',
    `Storyboard: ${storyboardSyntax()}`,
    'Pack refs look like network/router, flowchart/decision, uml/class, memory/stack-cell, sets/set. A ref that does not exist is rejected with the full list of valid ones.',
    'Rules:',
    '1. Use a storyboard. Pass `spec` only for something a storyboard cannot say, and then describe each step with builder.blocks (all times are in milliseconds; a time under 10 is rejected), never with hand-written tweens, bubble elements or overlays.',
    '2. Choose the layout that fits the idea: row for a pipeline, column for a stack, circle for a graph or a cycle, grid for a set of items. Leave x and y out unless a position matters.',
    '3. Use a pack object for a known thing (router, class, state) and a plain shape for the rest. Give every node a short label.',
    '4. Reveal the scene step by step: each step shows, highlights or draws one thing, and hides or dims what is finished. The first action on a node should be show if it appears later.',
    '5. Use 6 to 12 steps, one idea each. title is the short change, why is one sentence, say is the explanation.',
    '6. Pass title (and description) so the lecture is listed in the course in the same call; there is then no need for add_lecture_to_course_list. The result reports how many elements and blocks were saved and whether the lecture is editable.',
    'The result is validated and layout-checked before saving; if problems are listed, fix them and call again.',
  ].join('\n');
}

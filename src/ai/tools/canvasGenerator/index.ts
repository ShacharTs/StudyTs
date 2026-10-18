/**
 * AI-callable canvas generator tools: schema definitions (canvasGeneratorToolSchemas.ts),
 * default-scene construction (canvasSceneBuilder.ts), and the execute dispatcher
 * (canvasGeneratorExecute.ts). This file is the public barrel.
 */

export { CANVAS_GENERATOR_TOOLS } from './toolSchemas';
export { buildDefaultCanvasScene } from './defaultCanvasScene';
export { executeCanvasGeneratorTool } from './executeCanvasGeneratorTool';

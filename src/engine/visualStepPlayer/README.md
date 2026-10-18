# visualStepPlayer — data-driven SVG step engine on Anime.js v4

```text
VisualSpec (JSON-safe) -> VisualStepPlayer -> GenericSvgStage (SVG) -> one Anime.js timeline
```

Public entry: `@engine/visualStepPlayer` (import from the folder, not from the files below).

| File | What it is |
|---|---|
| `visualSpec.ts` | Re-exports the spec types from `src/core/types/visualSpec.ts` (`VisualSpec`, `VisualElementSpec`, `VisualStepSpec`, `VisualTweenSpec`, `VisualPipelineSpec`) |
| `buildStepTimeline.ts` | The only place that calls Anime.js: one master timeline, one label and pause boundary per step |
| `useStepTimeline.ts` | Hook: next step while resting plays; every other jump is an instant `seek` |
| `GenericSvgStage.tsx` | Renders the step-0 state; elements are found by `data-visual-id`. Kinds: `ellipse circle rect path text math bubble` |
| `PipelineBanner.tsx` | Reduction pipeline cards (numbered, optional `description` and `color`), driven by the step index |
| `VisualStepPlayer.tsx` | Validation gate + stage + banner + the existing `useStepPlayerNav` / `StepPlayerControls` |
| `index.ts` | Public exports, including the pure spec logic that lives in `src/core/visualSpec/` |

Pure spec logic (no React, usable by the server): `src/core/visualSpec/` — `visualSpecValidation.ts`, `visualSpecJson.ts` (`parseVisualSpecJson`, `checkVisualSpec`), `visualSpecKey.ts` (slug rule for saved specs), `visualSpecEdits.ts` (immutable edits used by the form editor).

Rules that keep it honest:
- Anime.js does all interpolation, seeking and pausing. No custom animation code anywhere else.
- A `VisualSpec` is plain JSON: tween `params` are numbers and strings only. Editors write specs; they never animate.
- Highlights tween `opacity` and a `currentColor` drop-shadow, not colours (Anime.js cannot interpolate `var(--token)` colours).
- Tween targets are element ids matching `/^[A-Za-z][A-Za-z0-9_-]*$/` and a tween needs at least one target.
- Demos are data, not code: `data/animejs/week01/lectures/*/model.json`.

Authoring and storage live outside the engine: `src/components/visualAuthoring/` (page at `/visual-steps[/<key>]`, JSON and Form modes),
`server/routes/visualSpecs.ts` (`/api/visual-specs`), table `VisualSpecDoc`, mirror files `data/_shared/visual-specs/<key>.json`.
- A step with no tweens is a timed narration-only step (600 ms).
- Specs may carry editor-only "builder" fields (shape, label parent, connector link, blocks); the player and validator ignore them.
- `checkVisualSpecLayout` (core/validation) checks what each step shows: text clear of stroked shape outlines and lines, no overlapping text boxes (bubble-N / strip-N slots excepted), everything inside the viewBox. Every `data/animejs` model is tested against it.

# Extracted Plan

Source thread: `019cafdc-ca1a-7201-95d1-f82167e5ad7c`
Source session: `/Users/kenneth/.codex/sessions/2026/03/02/rollout-2026-03-02T10-43-28-019cafdc-ca1a-7201-95d1-f82167e5ad7c.jsonl`
Extracted at: `2026-03-02`

---
# Plan: Single-Page Interactive Graph Presentation (Bun + Vanilla TypeScript)

## Summary
Build a single-page presentation app where each click advances a timeline step that mutates one graph scene (not full slide swaps).  
Chosen direction: **SVG-first renderer**, **TypeScript step array authoring**, **persistent line identities**, **smooth path morphs**, **draw-on-enter line animation**, **band shading by line-id pairs**, **click anywhere + ArrowLeft/ArrowRight + R reset**, **instant reset**.

## Locked Decisions
1. Target: single desktop browser presentation (projector-friendly styling).
2. Navigation: click next, ArrowRight next, ArrowLeft previous, `R` reset to step 0.
3. Authoring: typed TS step array.
4. Curve model: points plus Bézier control points.
5. Line behavior: persistent IDs across morph steps.
6. Style: minimal keynote-like light theme.
7. Timing: global defaults with per-step overrides.
8. Shading: specify by line-id pairs.
9. Labeling: auto at right endpoint with optional per-line overrides.
10. Word drop: auto-spawn above axis and animate down.
11. Dependencies: allow small focused runtime deps.
12. Renderer: SVG-first.
13. Reset: instant snap.

## Animation/Rendering Options Research and Recommendation
1. **Recommended v1 stack**: Native SVG + custom timeline controller + `d3-interpolate-path` for morphing.
2. Why this is best for your use case: easy axes/labels/bands, precise path control, smooth morphing, small dependency footprint, straightforward click-step orchestration.
3. Option B: D3 transitions (`d3-transition` + `attrTween`) for tween orchestration; stronger transition ergonomics, slightly heavier mental model.
4. Option C: Anime.js SVG utilities (`morphTo`, drawable paths); very productive but introduces a bigger animation abstraction.
5. Option D: Canvas-first; viable but more manual work for text/layout/hit behavior and less convenient for path/label semantics.

## Public Interfaces / Authoring Types (Decision-Complete)
```ts
type Vec2 = { x: number; y: number };
type BezierPoint = {
  x: number;
  y: number;
  cpIn?: Vec2;   // control point for incoming segment
  cpOut?: Vec2;  // control point for outgoing segment
};

type AxisConfig = {
  xVisible: boolean;
  yVisible: boolean;
  xLabel?: string;
  yLabel?: string;
  xRange: [number, number];
  yRange: [number, number];
};

type WordDropItem = {
  id: string;
  text: string;
  xTarget: number; // graph domain coordinate
};

type EndpointTerms = {
  start?: string;
  end?: string;
};

type LineStyle = {
  color: string;
  width: number;
  opacity?: number;
};

type LineLabel = {
  text: string;
  mode?: "auto-right" | "manual";
  position?: Vec2; // required when mode=manual
};

type LineState = {
  id: string;
  points: BezierPoint[];
  style: LineStyle;
  label: LineLabel;
  drawOnEnter?: boolean;
};

type BandState = {
  id: string;
  upperLineId: string;
  lowerLineId: string;
  fill: string;
  opacity: number;
  xMin?: number;
  xMax?: number;
};

type SceneState = {
  axes: AxisConfig;
  words: WordDropItem[];
  endpointTerms: EndpointTerms;
  lines: LineState[];
  bands: BandState[];
};

type Timing = {
  durationMs?: number;
  easing?: "linear" | "easeInOutCubic" | "easeOutCubic";
  staggerMs?: number;
};

type PresentationStep = {
  id: string;
  scene: SceneState;       // full snapshot for deterministic next/back/reset
  timing?: Timing;         // optional override over defaults
};

type PresentationConfig = {
  defaults: Required<Timing>;
  steps: PresentationStep[];
};
```

## Runtime Architecture
1. `PresentationController`: owns `currentStepIndex`, input bindings, transition lock, next/prev/reset methods.
2. `SceneDiffEngine`: compares `prevScene` to `nextScene`, emits render ops (word enter/exit, axis toggles, line enter/morph/exit, band enter/update/exit, label placement).
3. `SvgRenderer`: owns SVG layers (`axes`, `words`, `bands`, `lines`, `labels`, `overlay`) and id-indexed element maps.
4. `PathBuilder`: converts `BezierPoint[]` to SVG `d` string using cubic segments; linear fallback where control points missing.
5. `LineAnimator`:
   - Enter draw animation: set `stroke-dasharray`/`stroke-dashoffset` via `getTotalLength()`.
   - Morph animation: tween `d` strings with `interpolatePath(a,b)` each frame.
6. `BandGenerator`: samples upper/lower lines to build closed fill polygon/path.
7. `LabelPlacer`: default at right endpoint + simple collision nudge; manual override honored.
8. `Input layer`: document click for next; keyboard for next/prev/reset; ignore repeated input while transition is active.

## Initial Timeline Content (v1 storyboard)
1. Step 0: x-axis only as number line; word list visible above chart.
2. Step 1: words fly down to x-axis targets.
3. Step 2: words removed; start/end terms shown.
4. Step 3: y-axis appears with label.
5. Step 4+: lines enter with draw-on-enter.
6. Later steps: existing lines morph smoothly to new curves.
7. Occasional steps: shaded bands between selected line pairs appear/update/disappear.

## Files to Create (When Exiting Plan Mode)
1. `/Users/kenneth/Projects/code-effort-graph/package.json`
2. `/Users/kenneth/Projects/code-effort-graph/tsconfig.json`
3. `/Users/kenneth/Projects/code-effort-graph/server.ts`
4. `/Users/kenneth/Projects/code-effort-graph/index.html`
5. `/Users/kenneth/Projects/code-effort-graph/src/main.ts`
6. `/Users/kenneth/Projects/code-effort-graph/src/presentation/config.ts`
7. `/Users/kenneth/Projects/code-effort-graph/src/presentation/types.ts`
8. `/Users/kenneth/Projects/code-effort-graph/src/core/controller.ts`
9. `/Users/kenneth/Projects/code-effort-graph/src/core/diff.ts`
10. `/Users/kenneth/Projects/code-effort-graph/src/render/svg-renderer.ts`
11. `/Users/kenneth/Projects/code-effort-graph/src/render/path-builder.ts`
12. `/Users/kenneth/Projects/code-effort-graph/src/render/band-generator.ts`
13. `/Users/kenneth/Projects/code-effort-graph/src/render/label-placer.ts`
14. `/Users/kenneth/Projects/code-effort-graph/src/anim/line-animator.ts`
15. `/Users/kenneth/Projects/code-effort-graph/test/path-builder.test.ts`
16. `/Users/kenneth/Projects/code-effort-graph/test/diff.test.ts`
17. `/Users/kenneth/Projects/code-effort-graph/docs/PRD-graph-presentation.md`
18. `/Users/kenneth/Projects/code-effort-graph/docs/TECH-SPEC-graph-engine.md`
19. `/Users/kenneth/Projects/code-effort-graph/docs/ANIMATION-OPTIONS.md`
20. `/Users/kenneth/Projects/code-effort-graph/docs/AUTHORING-GUIDE.md`
21. `/Users/kenneth/Projects/code-effort-graph/AGENTS.md`

## Docs Content Plan
1. `PRD-graph-presentation.md`: goals, scope, user stories, acceptance criteria.
2. `TECH-SPEC-graph-engine.md`: architecture, types, diff rules, animation pipeline.
3. `ANIMATION-OPTIONS.md`: evaluated libraries, tradeoffs, chosen stack rationale.
4. `AUTHORING-GUIDE.md`: how to add/edit steps, lines, labels, bands, timing.
5. `AGENTS.md`: repo-wide execution rules (Bun-only commands, architecture boundaries, test expectations, no framework drift, keep timeline typed and deterministic).

## Test Cases and Scenarios
1. Path builder produces valid `d` for mixed linear/cubic segments.
2. Morph interpolation is smooth for persistent line IDs across adjacent steps.
3. Draw-on-enter animates from hidden stroke to full path.
4. Band generator creates closed shape between two lines and respects optional x-range.
5. Diff engine correctly classifies line enter/update/exit and band enter/update/exit.
6. Navigation: click next increments exactly one step; ArrowLeft decrements; ArrowRight increments; `R` returns to step 0 instantly.
7. Transition lock prevents double-advance during active animation.
8. Reset clears in-flight animations and snaps to canonical step 0 scene.
9. Label placement auto-right works and manual overrides take precedence.
10. Initial storyboard sequence matches your required order end-to-end.

## Explicit Assumptions / Defaults
1. Presentation runs primarily at 16:9 desktop resolution and remains usable on smaller screens.
2. No remote presenter sync or multi-client state sharing.
3. No audio/video embedding in v1.
4. No persisted state; refresh resets to step 0.
5. Reduced-motion accessibility support is included by shortening/skipping non-critical animation when `prefers-reduced-motion` is set.
6. For best morph quality, persistent lines should keep roughly similar point ordering across steps (engine will still interpolate mismatched paths).

## Implementation Order
1. ✅Scaffold Bun app and dev server (`Bun.serve` + HTML entry).
2. ✅Implement core types and presentation config.
3. ✅Build static SVG renderer and layer system.
4. ✅Build diff engine and navigation controller.
5. ✅Add line draw + morph animation.
6. ✅Add band shading + label placement.
7. ✅Encode initial storyboard steps.
8. ✅Polish presentation.
9. **User step** (not coding agent): write actual slides for presentation.
10. Deploy to github pages.

## Sources
- Bun HTML/static bundling: [bun.sh/docs/bundler/html](https://bun.sh/docs/bundler/html)
- Bun server + HTML imports: [bun.sh/docs/api/http](https://bun.sh/docs/api/http)
- Bun test runner: [bun.sh/docs/test](https://bun.sh/docs/test)
- D3 transitions and `attrTween`: [d3js.org/d3-transition/modifying](https://d3js.org/d3-transition/modifying)
- D3 shape/curve references: [d3js.org/d3-shape](https://d3js.org/d3-shape), [d3js.org/d3-shape/curve](https://d3js.org/d3-shape/curve)
- `d3-interpolate-path` package docs: [npmjs.com/package/d3-interpolate-path](https://www.npmjs.com/package/d3-interpolate-path)
- Flubber shape interpolation: [github.com/veltman/flubber](https://github.com/veltman/flubber)
- Anime.js SVG morph/draw utilities: [animejs.com/documentation/svg](https://animejs.com/documentation/svg), [animejs.com/documentation/svg/morphto](https://animejs.com/documentation/svg/morphto/)
- SVG path element + animation support: [developer.mozilla.org/.../SVG/Reference/Element/path](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/path)
- SVG path length for draw animation: [developer.mozilla.org/.../SVGPathElement/getTotalLength](https://developer.mozilla.org/en-US/docs/Web/API/SVGPathElement/getTotalLength)
- Stroke dash attributes: [developer.mozilla.org/.../SVG/Reference/Attribute/stroke-dasharray](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/stroke-dasharray)

import { LineAnimator } from "../anim/line-animator";
import type { SceneDiff } from "../core/diff";
import type { AxisConfig, BandState, LineState, SceneState, Vec2, BezierPoint } from "../presentation/types";
import { buildBandPath } from "./band-generator";
import { placeLineLabels } from "./label-placer";

const SVG_NS = "http://www.w3.org/2000/svg";

export const LAYER_ORDER = ["axes", "words", "bands", "lines", "labels", "overlay"] as const;
type LayerName = (typeof LAYER_ORDER)[number];

type RendererOptions = {
  width?: number;
  height?: number;
  margin?: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
};

type TransitionOptions = {
  durationMs: number;
  easing: "linear" | "easeInOutCubic" | "easeOutCubic";
  reducedMotion?: boolean;
};

type Margins = NonNullable<RendererOptions["margin"]>;

type ChartBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type EasingName = TransitionOptions["easing"];

const DEFAULT_MARGINS: Margins = {
  top: 40,
  right: 56,
  bottom: 72,
  left: 72,
};

export class SvgRenderer {
  private svg: SVGSVGElement;
  private defs: SVGDefsElement;
  private layers: Record<LayerName, SVGGElement>;
  private width: number;
  private height: number;
  private margins: Margins;
  private readonly lineAnimator: LineAnimator;
  private transitionVersion = 0;

  constructor(container: HTMLElement, options: RendererOptions = {}) {
    this.width = options.width ?? 920;
    this.height = options.height ?? 520;
    this.margins = options.margin ?? DEFAULT_MARGINS;
    this.lineAnimator = new LineAnimator();

    this.svg = document.createElementNS(SVG_NS, "svg");
    this.svg.setAttribute("viewBox", `0 0 ${this.width} ${this.height}`);
    this.svg.setAttribute("width", "100%");
    this.svg.setAttribute("height", "100%");
    this.svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    this.svg.setAttribute("role", "img");
    this.svg.setAttribute("aria-label", "Code effort graph scene");
    this.svg.style.display = "block";
    this.svg.style.background = "transparent";
    this.svg.style.border = "none";
    this.svg.style.borderRadius = "0";
    this.svg.style.boxShadow = "none";

    this.defs = document.createElementNS(SVG_NS, "defs");
    this.svg.append(this.defs);

    this.layers = {} as Record<LayerName, SVGGElement>;
    for (const name of LAYER_ORDER) {
      const layer = document.createElementNS(SVG_NS, "g");
      layer.setAttribute("data-layer", name);
      this.layers[name] = layer;
      this.svg.append(layer);
    }

    container.append(this.svg);
  }

  render(scene: SceneState): void {
    this.transitionVersion += 1;
    this.clearAllLayers();

    this.renderAxes(scene.axes);
    this.renderWords(scene.axes, scene.words);
    this.renderEndpointTerms(scene.axes, scene.endpointTerms);
    this.renderBands(scene.axes, scene.lines, scene.bands);
    this.renderLines(scene.axes, scene.lines);
    this.renderLineLabels(scene.axes, scene.lines);
  }

  async transition(
    previousScene: SceneState,
    nextScene: SceneState,
    diff: SceneDiff,
    options: TransitionOptions,
  ): Promise<void> {
    const version = ++this.transitionVersion;
    this.clearAllLayers();

    this.renderAxes(nextScene.axes);

    const previousWordById = new Map(previousScene.words.map((word) => [word.id, word] as const));
    const initialWordsById = new Map<string, SceneState["words"][number]>();
    for (const wordId of diff.words.updated) {
      const previousWord = previousWordById.get(wordId);
      if (previousWord) {
        initialWordsById.set(wordId, previousWord);
      }
    }

    const renderedWords = this.renderWordElements(nextScene.axes, nextScene.words, initialWordsById);
    this.renderEndpointTerms(nextScene.axes, nextScene.endpointTerms);
    const renderedBands = this.renderBands(nextScene.axes, nextScene.lines, nextScene.bands);

    const previousBandById = new Map(previousScene.bands.map((band) => [band.id, band] as const));
    const nextBandById = new Map(nextScene.bands.map((band) => [band.id, band] as const));
    const previousLineById = new Map(previousScene.lines.map((line) => [line.id, line] as const));
    const initialLinePoints = new Map<string, BezierPoint[]>();

    for (const lineId of diff.lines.updated) {
      const previousLine = previousLineById.get(lineId);
      if (previousLine) {
        initialLinePoints.set(lineId, previousLine.points);
      }
    }

    const renderedLines = this.renderLineElements(nextScene.axes, nextScene.lines, initialLinePoints);
    this.renderLineLabels(nextScene.axes, nextScene.lines);

    const durationMs = options.reducedMotion ? 0 : options.durationMs;
    const easing = options.easing;
    const animationTasks: Array<Promise<void>> = [];
    const nextWordById = new Map(nextScene.words.map((word) => [word.id, word] as const));
    const nextLineById = new Map(nextScene.lines.map((line) => [line.id, line] as const));

    for (const wordId of diff.words.updated) {
      const previousWord = previousWordById.get(wordId);
      const nextWord = nextWordById.get(wordId);
      const textElement = renderedWords.get(wordId);
      if (!previousWord || !nextWord || !textElement) continue;
      animationTasks.push(
        this.animateWordMove(
          textElement,
          this.getWordScreenPosition(previousScene.axes, previousWord),
          this.getWordScreenPosition(nextScene.axes, nextWord),
          {
            durationMs,
            easing,
            shouldCancel: () => this.transitionVersion !== version,
          },
        ),
      );
    }

    for (const bandId of diff.bands.entered) {
      const path = renderedBands.get(bandId);
      if (!path) continue;
      animationTasks.push(
        this.animateBandReveal(path, bandId, {
          durationMs,
          easing,
          shouldCancel: () => this.transitionVersion !== version,
        }),
      );
    }

    for (const bandId of diff.bands.updated) {
      const path = renderedBands.get(bandId);
      const previousBand = previousBandById.get(bandId);
      const nextBand = nextBandById.get(bandId);
      if (!path || !previousBand || !nextBand) continue;
      animationTasks.push(
        this.animateBandMorph(path, previousBand, nextBand, previousScene, nextScene, {
          durationMs,
          easing,
          shouldCancel: () => this.transitionVersion !== version,
        }),
      );
    }

    for (const lineId of diff.lines.entered) {
      const line = nextLineById.get(lineId);
      const path = renderedLines.get(lineId);
      if (!line || !path || !line.drawOnEnter) continue;
      animationTasks.push(
        this.lineAnimator.animateDraw(path, {
          durationMs,
          easing,
          shouldCancel: () => this.transitionVersion !== version,
        }),
      );
    }

    for (const lineId of diff.lines.updated) {
      const previousLine = previousLineById.get(lineId);
      const nextLine = nextLineById.get(lineId);
      const path = renderedLines.get(lineId);
      if (!previousLine || !nextLine || !path) continue;
      animationTasks.push(
        this.lineAnimator.animateMorph(path, previousLine.points, nextLine.points, {
          durationMs,
          easing,
          buildPath: (points) => this.buildLinePath(nextScene.axes, points),
          shouldCancel: () => this.transitionVersion !== version,
        }),
      );
    }

    if (animationTasks.length > 0) {
      await Promise.all(animationTasks);
    }
  }

  private clearAllLayers(): void {
    this.defs.replaceChildren();
    for (const name of LAYER_ORDER) {
      this.layers[name].replaceChildren();
    }
  }

  private getChartBounds(): ChartBounds {
    return {
      x: this.margins.left,
      y: this.margins.top,
      width: this.width - this.margins.left - this.margins.right,
      height: this.height - this.margins.top - this.margins.bottom,
    };
  }

  private toScreen(axis: AxisConfig, point: Vec2): Vec2 {
    const bounds = this.getChartBounds();
    const [xMin, xMax] = axis.xRange;
    const [yMin, yMax] = axis.yRange;
    const xSpan = xMax - xMin || 1;
    const ySpan = yMax - yMin || 1;

    return {
      x: bounds.x + ((point.x - xMin) / xSpan) * bounds.width,
      y: bounds.y + (1 - (point.y - yMin) / ySpan) * bounds.height,
    };
  }

  private renderAxes(axis: AxisConfig): void {
    const layer = this.layers.axes;
    const bounds = this.getChartBounds();
    const axisColor = "#000";

    if (axis.xVisible) {
      const yZero = this.toScreen(axis, { x: axis.xRange[0], y: 0 }).y;
      const xLine = createSvg("line", {
        x1: String(bounds.x),
        y1: String(yZero),
        x2: String(bounds.x + bounds.width),
        y2: String(yZero),
        stroke: axisColor,
        "stroke-width": "2",
      });
      layer.append(xLine);
    }

    if (axis.yVisible) {
      const xZero = this.toScreen(axis, { x: axis.xRange[0], y: 0 }).x;
      layer.append(
        createSvg("line", {
          x1: String(xZero),
          y1: String(bounds.y),
          x2: String(xZero),
          y2: String(bounds.y + bounds.height),
          stroke: axisColor,
          "stroke-width": "2",
        }),
      );
    }
  }

  private renderWords(axis: AxisConfig, words: SceneState["words"]): void {
    this.renderWordElements(axis, words);
  }

  private renderWordElements(
    axis: AxisConfig,
    words: SceneState["words"],
    initialWordsById: Map<string, SceneState["words"][number]> = new Map(),
  ): Map<string, SVGTextElement> {
    const layer = this.layers.words;
    const renderedWords = new Map<string, SVGTextElement>();

    for (const word of words) {
      const initialWord = initialWordsById.get(word.id) ?? word;
      const point = this.getWordScreenPosition(axis, initialWord);
      const text = createSvg("text", {
        x: String(point.x),
        y: String(point.y),
        fill: "#000",
        "font-size": "18",
        "font-weight": "700",
        "text-anchor": "middle",
      });
      text.textContent = word.text;
      text.setAttribute("data-word-id", word.id);
      layer.append(text);
      renderedWords.set(word.id, text);
    }

    return renderedWords;
  }

  private renderEndpointTerms(axis: AxisConfig, endpointTerms: SceneState["endpointTerms"]): void {
    const layer = this.layers.overlay;
    const xAxisY = this.toScreen(axis, { x: axis.xRange[0], y: 0 }).y;

    if (endpointTerms.start) {
      const startLabel = createSvg("text", {
        x: String(this.getChartBounds().x),
        y: String(xAxisY + 36),
        fill: "#000",
        "font-size": "14",
        "font-weight": "600",
        "text-anchor": "start",
      });
      startLabel.textContent = endpointTerms.start;
      layer.append(startLabel);
    }

    if (endpointTerms.end) {
      const bounds = this.getChartBounds();
      const endLabel = createSvg("text", {
        x: String(bounds.x + bounds.width),
        y: String(xAxisY + 36),
        fill: "#000",
        "font-size": "14",
        "font-weight": "600",
        "text-anchor": "end",
      });
      endLabel.textContent = endpointTerms.end;
      layer.append(endLabel);
    }
  }

  private renderLines(axis: AxisConfig, lines: LineState[]): void {
    this.renderLineElements(axis, lines);
  }

  private renderLineElements(
    axis: AxisConfig,
    lines: LineState[],
    initialPointsById: Map<string, BezierPoint[]> = new Map(),
  ): Map<string, SVGPathElement> {
    const layer = this.layers.lines;
    const renderedLines = new Map<string, SVGPathElement>();

    for (const line of lines) {
      const initialPoints = initialPointsById.get(line.id) ?? line.points;
      const d = this.buildLinePath(axis, initialPoints);
      if (!d) continue;

      const path = createSvg("path", {
        d,
        fill: "none",
        stroke: line.style.color,
        "stroke-width": String(line.style.width),
        "stroke-opacity": String(line.style.opacity ?? 1),
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
      });
      path.setAttribute("data-line-id", line.id);
      layer.append(path);
      renderedLines.set(line.id, path);
    }

    return renderedLines;
  }

  private renderLineLabels(axis: AxisConfig, lines: LineState[]): void {
    const layer = this.layers.labels;
    const labelPlacements = placeLineLabels(
      lines,
      (point) => this.toScreen(axis, point),
      { bounds: this.getChartBounds() },
    );

    for (const label of labelPlacements) {
      const text = createSvg("text", {
        x: String(label.position.x),
        y: String(label.position.y),
        fill: label.color,
        "font-size": "14",
        "font-weight": "600",
      });
      text.textContent = label.text;
      layer.append(text);
    }
  }

  private renderBands(axis: AxisConfig, lines: LineState[], bands: BandState[]): Map<string, SVGPathElement> {
    const layer = this.layers.bands;
    const lineMap = new Map(lines.map((line) => [line.id, line] as const));
    const renderedBands = new Map<string, SVGPathElement>();

    for (const band of bands) {
      const d = buildBandPath(band, lineMap, (point) => this.toScreen(axis, point));
      if (!d) continue;

      const path = createSvg("path", {
        d,
        fill: band.fill,
        "fill-opacity": String(band.opacity),
      });
      path.setAttribute("data-band-id", band.id);
      layer.append(path);
      renderedBands.set(band.id, path);
    }

    return renderedBands;
  }

  private async animateWordMove(
    textElement: SVGTextElement,
    from: Vec2,
    to: Vec2,
    options: {
      durationMs: number;
      easing: EasingName;
      shouldCancel?: () => boolean;
    },
  ): Promise<void> {
    if (options.durationMs <= 0) {
      textElement.setAttribute("x", String(to.x));
      textElement.setAttribute("y", String(to.y));
      return;
    }

    await animateProgress({
      durationMs: options.durationMs,
      easing: options.easing,
      shouldCancel: options.shouldCancel,
      onFrame: (progress) => {
        const x = from.x + (to.x - from.x) * progress;
        const y = from.y + (to.y - from.y) * progress;
        textElement.setAttribute("x", String(x));
        textElement.setAttribute("y", String(y));
      },
    });
  }

  private async animateBandReveal(
    path: SVGPathElement,
    bandId: string,
    options: {
      durationMs: number;
      easing: EasingName;
      shouldCancel?: () => boolean;
    },
  ): Promise<void> {
    const duration = Math.max(0, options.durationMs);
    if (duration === 0) {
      return;
    }

    const bbox = path.getBBox();
    if (bbox.width <= 0 || bbox.height <= 0) {
      return;
    }

    const clipId = `band-reveal-${sanitizeId(bandId)}-${this.transitionVersion}`;
    const clipPath = createSvg("clipPath", {
      id: clipId,
      clipPathUnits: "userSpaceOnUse",
    });
    const clipRect = createSvg("rect", {
      x: String(bbox.x),
      y: String(bbox.y),
      width: "0",
      height: String(bbox.height),
    });

    clipPath.append(clipRect);
    this.defs.append(clipPath);
    path.setAttribute("clip-path", `url(#${clipId})`);

    await animateProgress({
      durationMs: duration,
      easing: options.easing,
      shouldCancel: options.shouldCancel,
      onFrame: (progress) => {
        clipRect.setAttribute("width", String(bbox.width * progress));
      },
    });

    path.removeAttribute("clip-path");
    clipPath.remove();
  }

  private async animateBandMorph(
    path: SVGPathElement,
    previousBand: BandState,
    nextBand: BandState,
    previousScene: SceneState,
    nextScene: SceneState,
    options: {
      durationMs: number;
      easing: EasingName;
      shouldCancel?: () => boolean;
    },
  ): Promise<void> {
    if (options.durationMs <= 0) {
      return;
    }

    const previousLineById = new Map(previousScene.lines.map((line) => [line.id, line] as const));
    const nextLineById = new Map(nextScene.lines.map((line) => [line.id, line] as const));

    const applyBandFrame = (progress: number): void => {
      const bandAtProgress = interpolateBand(previousBand, nextBand, previousScene.axes, nextScene.axes, progress);
      const bandPath = buildBandPath(
        bandAtProgress,
        this.buildInterpolatedBandLineMap(previousBand, nextBand, previousLineById, nextLineById, progress),
        (point) => this.toScreen(nextScene.axes, point),
      );
      if (bandPath) {
        path.setAttribute("d", bandPath);
      }
      path.setAttribute("fill", interpolateColor(previousBand.fill, nextBand.fill, progress));
      path.setAttribute("fill-opacity", String(lerp(previousBand.opacity, nextBand.opacity, progress)));
    };

    applyBandFrame(0);
    await animateProgress({
      durationMs: options.durationMs,
      easing: options.easing,
      shouldCancel: options.shouldCancel,
      onFrame: applyBandFrame,
    });
  }

  private buildInterpolatedBandLineMap(
    previousBand: BandState,
    nextBand: BandState,
    previousLineById: Map<string, LineState>,
    nextLineById: Map<string, LineState>,
    progress: number,
  ): Map<string, LineState> {
    const lines = new Map<string, LineState>();
    const upperLine = this.interpolateBandLine(
      previousBand.upperLineId,
      nextBand.upperLineId,
      previousLineById,
      nextLineById,
      progress,
    );
    const lowerLine = this.interpolateBandLine(
      previousBand.lowerLineId,
      nextBand.lowerLineId,
      previousLineById,
      nextLineById,
      progress,
    );

    if (upperLine) {
      lines.set(nextBand.upperLineId, upperLine);
      lines.set(previousBand.upperLineId, upperLine);
    }
    if (lowerLine) {
      lines.set(nextBand.lowerLineId, lowerLine);
      lines.set(previousBand.lowerLineId, lowerLine);
    }

    return lines;
  }

  private interpolateBandLine(
    previousLineId: string,
    nextLineId: string,
    previousLineById: Map<string, LineState>,
    nextLineById: Map<string, LineState>,
    progress: number,
  ): LineState | null {
    const fromLine = previousLineById.get(previousLineId) ?? previousLineById.get(nextLineId);
    const toLine = nextLineById.get(nextLineId) ?? nextLineById.get(previousLineId);
    if (!fromLine || !toLine) {
      return null;
    }

    return {
      ...toLine,
      points: interpolateBezierPoints(fromLine.points, toLine.points, progress),
    };
  }

  private buildLinePath(axis: AxisConfig, points: BezierPoint[]): string {
    const [first, ...rest] = points;
    if (!first) return "";

    const firstScreen = this.toScreen(axis, first);
    const commands: string[] = [`M ${firstScreen.x} ${firstScreen.y}`];

    for (const [index, point] of rest.entries()) {
      const previous = points[index];
      if (!previous) continue;

      const hasCurve = Boolean(previous.cpOut || point.cpIn);
      const target = this.toScreen(axis, point);

      if (hasCurve) {
        const cpOut = previous.cpOut ?? { x: previous.x, y: previous.y };
        const cpIn = point.cpIn ?? { x: point.x, y: point.y };
        const screenCpOut = this.toScreen(axis, cpOut);
        const screenCpIn = this.toScreen(axis, cpIn);
        commands.push(`C ${screenCpOut.x} ${screenCpOut.y}, ${screenCpIn.x} ${screenCpIn.y}, ${target.x} ${target.y}`);
      } else {
        commands.push(`L ${target.x} ${target.y}`);
      }
    }

    return commands.join(" ");
  }

  private getWordScreenPosition(axis: AxisConfig, word: SceneState["words"][number]): Vec2 {
    const axisPoint = this.toScreen(axis, { x: word.xTarget, y: 0 });
    return {
      x: axisPoint.x,
      y: axisPoint.y + (word.yOffsetPx ?? -20),
    };
  }
}

function createSvg<K extends keyof SVGElementTagNameMap>(
  tagName: K,
  attributes: Record<string, string>,
): SVGElementTagNameMap[K] {
  const element = document.createElementNS(SVG_NS, tagName);
  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, value);
  }
  return element;
}

function sanitizeId(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]/g, "-");
}

function interpolateBand(
  previousBand: BandState,
  nextBand: BandState,
  previousAxis: AxisConfig,
  nextAxis: AxisConfig,
  progress: number,
): BandState {
  const previousMin = previousBand.xMin ?? previousAxis.xRange[0];
  const nextMin = nextBand.xMin ?? nextAxis.xRange[0];
  const previousMax = previousBand.xMax ?? previousAxis.xRange[1];
  const nextMax = nextBand.xMax ?? nextAxis.xRange[1];

  return {
    ...nextBand,
    xMin: lerp(previousMin, nextMin, progress),
    xMax: lerp(previousMax, nextMax, progress),
    opacity: lerp(previousBand.opacity, nextBand.opacity, progress),
  };
}

function interpolateBezierPoints(fromPoints: BezierPoint[], toPoints: BezierPoint[], t: number): BezierPoint[] {
  if (fromPoints.length !== toPoints.length) {
    return t < 1 ? fromPoints : toPoints;
  }

  return fromPoints.map((from, index) => {
    const to = toPoints[index]!;
    return {
      x: lerp(from.x, to.x, t),
      y: lerp(from.y, to.y, t),
      cpIn: interpolateMaybeVec2(from.cpIn, to.cpIn, t),
      cpOut: interpolateMaybeVec2(from.cpOut, to.cpOut, t),
    };
  });
}

function interpolateMaybeVec2(from: Vec2 | undefined, to: Vec2 | undefined, t: number): Vec2 | undefined {
  if (!from && !to) return undefined;
  const fromPoint = from ?? to!;
  const toPoint = to ?? from!;
  return {
    x: lerp(fromPoint.x, toPoint.x, t),
    y: lerp(fromPoint.y, toPoint.y, t),
  };
}

function parseHexColor(value: string): [number, number, number] | null {
  const hex = value.trim();
  if (/^#([a-f\d]{3})$/i.test(hex)) {
    const [r, g, b] = hex
      .slice(1)
      .split("")
      .map((part) => Number.parseInt(part + part, 16));
    return [r!, g!, b!];
  }
  if (/^#([a-f\d]{6})$/i.test(hex)) {
    return [
      Number.parseInt(hex.slice(1, 3), 16),
      Number.parseInt(hex.slice(3, 5), 16),
      Number.parseInt(hex.slice(5, 7), 16),
    ];
  }
  return null;
}

function interpolateColor(from: string, to: string, t: number): string {
  const fromRgb = parseHexColor(from);
  const toRgb = parseHexColor(to);
  if (!fromRgb || !toRgb) {
    return t < 1 ? from : to;
  }

  const r = Math.round(lerp(fromRgb[0], toRgb[0], t));
  const g = Math.round(lerp(fromRgb[1], toRgb[1], t));
  const b = Math.round(lerp(fromRgb[2], toRgb[2], t));

  return `rgb(${r}, ${g}, ${b})`;
}

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

function easingFunction(name: EasingName): (value: number) => number {
  if (name === "easeOutCubic") {
    return (value) => 1 - Math.pow(1 - value, 3);
  }
  if (name === "easeInOutCubic") {
    return (value) => (value < 0.5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2);
  }
  return (value) => value;
}

async function animateProgress(options: {
  durationMs: number;
  easing: EasingName;
  shouldCancel?: () => boolean;
  onFrame: (progress: number) => void;
}): Promise<void> {
  const duration = Math.max(0, options.durationMs);
  if (duration === 0) {
    options.onFrame(1);
    return;
  }

  const easing = easingFunction(options.easing);

  return new Promise((resolve) => {
    const start = performance.now();
    const tick = (now: number) => {
      if (options.shouldCancel?.()) {
        resolve();
        return;
      }

      const elapsed = now - start;
      const linearProgress = Math.min(1, elapsed / duration);
      options.onFrame(easing(linearProgress));
      if (linearProgress >= 1) {
        resolve();
        return;
      }
      requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  });
}

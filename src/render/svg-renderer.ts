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
    this.svg.setAttribute("height", String(this.height));
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
    this.renderWords(nextScene.axes, nextScene.words);
    this.renderEndpointTerms(nextScene.axes, nextScene.endpointTerms);
    const renderedBands = this.renderBands(nextScene.axes, nextScene.lines, nextScene.bands);

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
    const nextLineById = new Map(nextScene.lines.map((line) => [line.id, line] as const));

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
    const layer = this.layers.words;
    const xAxisY = this.toScreen(axis, { x: axis.xRange[0], y: 0 }).y;
    for (const word of words) {
      const point = this.toScreen(axis, { x: word.xTarget, y: 0 });
      const text = createSvg("text", {
        x: String(point.x),
        y: String(xAxisY - 20),
        fill: "#000",
        "font-size": "18",
        "font-weight": "700",
        "text-anchor": "middle",
      });
      text.textContent = word.text;
      layer.append(text);
    }
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

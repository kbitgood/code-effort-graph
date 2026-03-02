import { LineAnimator } from "../anim/line-animator";
import type { SceneDiff } from "../core/diff";
import type { AxisConfig, BandState, LineState, SceneState, Vec2, BezierPoint } from "../presentation/types";

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

const DEFAULT_MARGINS: Margins = {
  top: 40,
  right: 56,
  bottom: 72,
  left: 72,
};

export class SvgRenderer {
  private svg: SVGSVGElement;
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
    this.renderBands(nextScene.axes, nextScene.lines, nextScene.bands);

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
    const tickColor = "#000";
    const labelColor = "#000";

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

      const tickCount = 6;
      for (let i = 0; i <= tickCount; i += 1) {
        const ratio = i / tickCount;
        const domainX = axis.xRange[0] + ratio * (axis.xRange[1] - axis.xRange[0]);
        const x = this.toScreen(axis, { x: domainX, y: 0 }).x;

        layer.append(
          createSvg("line", {
            x1: String(x),
            y1: String(yZero - 6),
            x2: String(x),
            y2: String(yZero + 6),
            stroke: tickColor,
            "stroke-width": "1.2",
          }),
        );

        const tickLabel = createSvg("text", {
          x: String(x),
          y: String(yZero + 22),
          fill: "#000",
          "font-size": "12",
          "text-anchor": "middle",
        });
        tickLabel.textContent = domainX.toFixed(1).replace(/\.0$/, "");
        layer.append(tickLabel);
      }

      if (axis.xLabel) {
        const label = createSvg("text", {
          x: String(bounds.x + bounds.width / 2),
          y: String(bounds.y + bounds.height + 52),
          fill: labelColor,
          "font-size": "14",
          "font-weight": "600",
          "text-anchor": "middle",
        });
        label.textContent = axis.xLabel;
        layer.append(label);
      }
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

      const tickCount = 5;
      for (let i = 0; i <= tickCount; i += 1) {
        const ratio = i / tickCount;
        const domainY = axis.yRange[0] + ratio * (axis.yRange[1] - axis.yRange[0]);
        const y = this.toScreen(axis, { x: axis.xRange[0], y: domainY }).y;

        layer.append(
          createSvg("line", {
            x1: String(xZero - 6),
            y1: String(y),
            x2: String(xZero + 6),
            y2: String(y),
            stroke: tickColor,
            "stroke-width": "1.2",
          }),
        );

        const tickLabel = createSvg("text", {
          x: String(xZero - 12),
          y: String(y + 4),
          fill: "#000",
          "font-size": "12",
          "text-anchor": "end",
        });
        tickLabel.textContent = domainY.toFixed(1).replace(/\.0$/, "");
        layer.append(tickLabel);
      }

      if (axis.yLabel) {
        const label = createSvg("text", {
          x: String(bounds.x - 52),
          y: String(bounds.y + bounds.height / 2),
          fill: labelColor,
          "font-size": "14",
          "font-weight": "600",
          "text-anchor": "middle",
          transform: `rotate(-90 ${bounds.x - 52} ${bounds.y + bounds.height / 2})`,
        });
        label.textContent = axis.yLabel;
        layer.append(label);
      }
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

    for (const line of lines) {
      const last = line.points[line.points.length - 1];
      if (!last) continue;

      let labelPoint: Vec2;
      if (line.label.mode === "manual" && line.label.position) {
        labelPoint = this.toScreen(axis, line.label.position);
      } else {
        const endpoint = this.toScreen(axis, { x: last.x, y: last.y });
        labelPoint = { x: endpoint.x + 10, y: endpoint.y - 8 };
      }

      const text = createSvg("text", {
        x: String(labelPoint.x),
        y: String(labelPoint.y),
        fill: "#000",
        "font-size": "14",
        "font-weight": "600",
      });
      text.textContent = line.label.text;
      layer.append(text);
    }
  }

  private renderBands(axis: AxisConfig, lines: LineState[], bands: BandState[]): void {
    const layer = this.layers.bands;
    const lineMap = new Map(lines.map((line) => [line.id, line] as const));

    for (const band of bands) {
      const upper = lineMap.get(band.upperLineId);
      const lower = lineMap.get(band.lowerLineId);
      if (!upper || !lower) continue;

      const upperPoints = this.filterBandPoints(upper.points, band.xMin, band.xMax);
      const lowerPoints = this.filterBandPoints(lower.points, band.xMin, band.xMax);
      if (upperPoints.length < 2 || lowerPoints.length < 2) continue;

      const outline = [
        ...upperPoints.map((point) => this.toScreen(axis, point)),
        ...lowerPoints.reverse().map((point) => this.toScreen(axis, point)),
      ];

      const d = outline.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ") + " Z";

      const path = createSvg("path", {
        d,
        fill: band.fill,
        "fill-opacity": String(band.opacity),
      });
      path.setAttribute("data-band-id", band.id);
      layer.append(path);
    }
  }

  private filterBandPoints(points: BezierPoint[], xMin?: number, xMax?: number): Vec2[] {
    return points
      .filter((point) => (xMin === undefined || point.x >= xMin) && (xMax === undefined || point.x <= xMax))
      .map((point) => ({ x: point.x, y: point.y }));
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

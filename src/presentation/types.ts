export type Vec2 = { x: number; y: number };

export type BezierPoint = {
  x: number;
  y: number;
  cpIn?: Vec2;
  cpOut?: Vec2;
};

export type AxisConfig = {
  xVisible: boolean;
  yVisible: boolean;
  xLabel?: string;
  yLabel?: string;
  xRange: [number, number];
  yRange: [number, number];
};

export type WordDropItem = {
  id: string;
  text: string;
  xTarget: number;
};

export type EndpointTerms = {
  start?: string;
  end?: string;
};

export type LineStyle = {
  color: string;
  width: number;
  opacity?: number;
};

export type LineLabel = {
  text: string;
  mode?: "auto-right" | "manual";
  position?: Vec2;
};

export type LineState = {
  id: string;
  points: BezierPoint[];
  style: LineStyle;
  label: LineLabel;
  drawOnEnter?: boolean;
};

export type BandState = {
  id: string;
  upperLineId: string;
  lowerLineId: string;
  fill: string;
  opacity: number;
  xMin?: number;
  xMax?: number;
};

export type SceneState = {
  axes: AxisConfig;
  words: WordDropItem[];
  endpointTerms: EndpointTerms;
  lines: LineState[];
  bands: BandState[];
};

export type Timing = {
  durationMs?: number;
  easing?: "linear" | "easeInOutCubic" | "easeOutCubic";
  staggerMs?: number;
};

export type PresentationStep = {
  id: string;
  scene: SceneState;
  timing?: Timing;
};

export type PresentationConfig = {
  defaults: Required<Timing>;
  steps: PresentationStep[];
};

import type { LineState, PresentationConfig } from "./types";

const firstSlideItems = [
  "internal tooling",
  "dev tooling",
  "ci/cd scripts",
  "unit tests",
  "e2e tests",
  "infrastructure",
  "app code",
  "lti code",
  "quiz code",
  "lesson code",
];

const lineSpacingPx = 38;
const positionedItems = firstSlideItems.map((text, index, all) => ({
  id: `item-${index + 1}`,
  text,
  xTarget: 5,
  yOffsetPx: (index - (all.length - 1) / 2) * lineSpacingPx,
}));

const hiddenImpactTitlePreAxis = {
  id: "impact-title",
  text: "impact of mistakes",
  xTarget: 5,
  yOffsetPx: 176,
  fontSizePx: 22,
  fontWeight: 700,
  opacity: 0,
};

const buildUpSteps = firstSlideItems.map((text, index) => ({
  id: `step-${index + 1}-${text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`,
  scene: {
    axes: {
      xVisible: false,
      yVisible: false,
      xRange: [0, 10] as [number, number],
      yRange: [-5, 5] as [number, number],
    },
    words: [...positionedItems.slice(0, index + 1), hiddenImpactTitlePreAxis],
    endpointTerms: {},
    lines: [],
    bands: [],
  },
}));

const axisAlignedItems = firstSlideItems.map((text, index) => ({
  id: `item-${index + 1}`,
  text,
  xTarget: index + 1,
  yOffsetPx: 86,
  rotateDeg: -75,
}));

const impactSideLabels = [
  {
    id: "impact-low",
    text: "low impact",
    xTarget: 0.8,
    yOffsetPx: 34,
    fontSizePx: 18,
    fontWeight: 700,
  },
  {
    id: "impact-critical",
    text: "critical impact",
    xTarget: 10.2,
    yOffsetPx: 34,
    fontSizePx: 18,
    fontWeight: 700,
  },
];

const impactTitleAboveLine = {
  id: "impact-title",
  text: "impact of mistakes",
  xTarget: 5.5,
  yOffsetPx: -28,
  fontSizePx: 22,
  fontWeight: 700,
};

const impactTitleFinal = {
  id: "impact-title",
  text: "impact of mistakes",
  xTarget: 5.5,
  yOffsetPx: 64,
  fontSizePx: 22,
  fontWeight: 700,
};

const hiddenImpactSideLabels = impactSideLabels.map((label) => ({
  ...label,
  opacity: 0,
}));

const visibleImpactSideLabels = impactSideLabels.map((label) => ({
  ...label,
  opacity: 1,
}));

const visibleImpactTitleAboveLine = {
  ...impactTitleAboveLine,
  opacity: 1,
};

const visibleImpactTitleFinal = {
  ...impactTitleFinal,
  opacity: 1,
};

const yAxisLabel = {
  id: "effort-axis-label",
  text: "effort or something ¯\\_(ツ)_/¯",
  xTarget: -0.75,
  yOffsetPx: -192,
  fontSizePx: 22,
  fontWeight: 700,
  rotateDeg: -90,
};

const hiddenYAxisLabel = {
  ...yAxisLabel,
  opacity: 0,
};

const visibleYAxisLabel = {
  ...yAxisLabel,
  opacity: 1,
};

const fadedAxisAlignedItems = axisAlignedItems.map((word) => ({
  ...word,
  opacity: 0,
}));

const maxEffortLine: LineState = {
  id: "line-max-effort",
  points: [
    { x: 0, y: 0 },
    { x: 11, y: 10 },
  ],
  style: {
    color: "#dc2626",
    width: 3,
    opacity: 1,
  },
  label: {
    text: "max effort",
    mode: "manual",
    position: { x: 11.5, y: 10 },
  },
  drawOnEnter: true,
};

const devEffortLine: LineState = {
  id: "line-dev-effort",
  points: [
    { x: 0, y: 4 },
    { x: 11, y: 4 },
  ],
  style: {
    color: "#2563eb",
    width: 3,
    opacity: 1,
  },
  label: {
    text: "dev effort",
    mode: "manual",
    position: { x: 11.5, y: 4 },
  },
  drawOnEnter: true,
};

const steps = [
  ...buildUpSteps,
  {
    id: "step-11-axis-fade-and-align",
    timing: {
      durationMs: 1100,
      easing: "easeInOutCubic" as const,
    },
    scene: {
      axes: {
        xVisible: true,
        yVisible: false,
        xRange: [0, 11] as [number, number],
        yRange: [0, 10] as [number, number],
      },
      words: [...axisAlignedItems, ...hiddenImpactSideLabels, visibleImpactTitleAboveLine],
      endpointTerms: {},
      lines: [],
      bands: [],
    },
  },
  {
    id: "step-12-impact-axis-labels",
    timing: {
      durationMs: 1000,
      easing: "easeInOutCubic" as const,
    },
    scene: {
      axes: {
        xVisible: true,
        yVisible: false,
        xRange: [0, 11] as [number, number],
        yRange: [0, 10] as [number, number],
      },
      words: [
        ...fadedAxisAlignedItems,
        ...visibleImpactSideLabels,
        visibleImpactTitleFinal,
        hiddenYAxisLabel,
      ],
      endpointTerms: {},
      lines: [],
      bands: [],
    },
  },
  {
    id: "step-13-y-axis-wipe",
    timing: {
      durationMs: 1000,
      easing: "easeInOutCubic" as const,
    },
    scene: {
      axes: {
        xVisible: true,
        yVisible: true,
        xRange: [0, 11] as [number, number],
        yRange: [0, 10] as [number, number],
      },
      words: [...fadedAxisAlignedItems, ...visibleImpactSideLabels, visibleImpactTitleFinal, visibleYAxisLabel],
      endpointTerms: {},
      lines: [],
      bands: [],
    },
  },
  {
    id: "step-14-max-effort-line",
    timing: {
      durationMs: 1000,
      easing: "easeInOutCubic" as const,
    },
    scene: {
      axes: {
        xVisible: true,
        yVisible: true,
        xRange: [0, 11] as [number, number],
        yRange: [0, 10] as [number, number],
      },
      words: [...fadedAxisAlignedItems, ...visibleImpactSideLabels, visibleImpactTitleFinal, visibleYAxisLabel],
      endpointTerms: {},
      lines: [maxEffortLine],
      bands: [],
    },
  },
  {
    id: "step-15-dev-effort-line",
    timing: {
      durationMs: 1000,
      easing: "easeInOutCubic" as const,
    },
    scene: {
      axes: {
        xVisible: true,
        yVisible: true,
        xRange: [0, 11] as [number, number],
        yRange: [0, 10] as [number, number],
      },
      words: [...fadedAxisAlignedItems, ...visibleImpactSideLabels, visibleImpactTitleFinal, visibleYAxisLabel],
      endpointTerms: {},
      lines: [maxEffortLine, devEffortLine],
      bands: [],
    },
  },
];

export const presentationConfig: PresentationConfig = {
  defaults: {
    durationMs: 800,
    easing: "easeInOutCubic",
    staggerMs: 90,
  },
  steps,
};

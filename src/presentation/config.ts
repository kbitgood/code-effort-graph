import type { LineState, PresentationConfig, WordDropItem } from "./types";

const baseWords: WordDropItem[] = [
  { id: "word-clarity", text: "Clarity", xTarget: 1.2 },
  { id: "word-speed", text: "Speed", xTarget: 2.5 },
  { id: "word-quality", text: "Quality", xTarget: 3.8 },
  { id: "word-impact", text: "Impact", xTarget: 5.1 },
];

const baseAxes = {
  xVisible: true,
  xRange: [0, 6] as [number, number],
  yRange: [0, 10] as [number, number],
};

const baseLineStyle = {
  color: "#2563eb",
  width: 3,
  opacity: 1,
};

const supportLineStyle = {
  color: "#ea580c",
  width: 3,
  opacity: 1,
};

const lineEnter: LineState = {
  id: "line-core-effort",
  style: baseLineStyle,
  label: {
    text: "Core Effort",
  },
  drawOnEnter: true,
  points: [
    { x: 0.3, y: 1.2 },
    { x: 1.4, y: 2.5, cpIn: { x: 1.0, y: 1.6 } },
    { x: 2.8, y: 4.2, cpIn: { x: 2.2, y: 3.2 }, cpOut: { x: 3.1, y: 5.0 } },
    { x: 4.2, y: 5.5, cpIn: { x: 3.5, y: 4.8 }, cpOut: { x: 4.6, y: 6.8 } },
    { x: 5.6, y: 6.3, cpIn: { x: 5.0, y: 6.0 } },
  ],
};

const lineMorphed: LineState = {
  id: "line-core-effort",
  style: baseLineStyle,
  label: {
    text: "Core Effort",
  },
  points: [
    { x: 0.3, y: 1.6 },
    { x: 1.4, y: 3.1, cpIn: { x: 0.9, y: 2.2 }, cpOut: { x: 1.7, y: 3.7 } },
    { x: 2.8, y: 3.7, cpIn: { x: 2.3, y: 4.4 }, cpOut: { x: 3.0, y: 3.3 } },
    { x: 4.2, y: 6.8, cpIn: { x: 3.6, y: 5.1 }, cpOut: { x: 4.8, y: 7.3 } },
    { x: 5.6, y: 7.4, cpIn: { x: 5.1, y: 7.1 } },
  ],
};

const supportLine: LineState = {
  id: "line-support-load",
  style: supportLineStyle,
  label: {
    text: "Support Load",
    mode: "manual",
    position: { x: 4.8, y: 6.0 },
  },
  drawOnEnter: true,
  points: [
    { x: 0.3, y: 1.2 },
    { x: 1.4, y: 2.7, cpIn: { x: 0.9, y: 2.0 }, cpOut: { x: 1.8, y: 3.2 } },
    { x: 2.8, y: 3.3, cpIn: { x: 2.2, y: 3.6 }, cpOut: { x: 3.1, y: 3.1 } },
    { x: 4.2, y: 6.0, cpIn: { x: 3.6, y: 4.7 }, cpOut: { x: 4.7, y: 6.5 } },
    { x: 5.6, y: 7.1, cpIn: { x: 5.1, y: 6.9 } },
  ],
};

export const presentationConfig: PresentationConfig = {
  defaults: {
    durationMs: 800,
    easing: "easeInOutCubic",
    staggerMs: 90,
  },
  steps: [
    {
      id: "step-0-number-line",
      scene: {
        axes: {
          ...baseAxes,
          yVisible: false,
          xLabel: "Timeline",
        },
        words: baseWords,
        endpointTerms: {},
        lines: [],
        bands: [],
      },
    },
    {
      id: "step-1-word-drop",
      timing: {
        durationMs: 900,
        staggerMs: 120,
      },
      scene: {
        axes: {
          ...baseAxes,
          yVisible: false,
          xLabel: "Timeline",
        },
        words: baseWords,
        endpointTerms: {},
        lines: [],
        bands: [],
      },
    },
    {
      id: "step-2-endpoint-terms",
      scene: {
        axes: {
          ...baseAxes,
          yVisible: false,
          xLabel: "Timeline",
        },
        words: [],
        endpointTerms: {
          start: "Problem",
          end: "Outcome",
        },
        lines: [],
        bands: [],
      },
    },
    {
      id: "step-3-y-axis-intro",
      scene: {
        axes: {
          ...baseAxes,
          yVisible: true,
          xLabel: "Timeline",
          yLabel: "Code Effort",
        },
        words: [],
        endpointTerms: {
          start: "Problem",
          end: "Outcome",
        },
        lines: [],
        bands: [],
      },
    },
    {
      id: "step-4-line-enter",
      timing: {
        durationMs: 900,
        easing: "easeOutCubic",
      },
      scene: {
        axes: {
          ...baseAxes,
          yVisible: true,
          xLabel: "Timeline",
          yLabel: "Code Effort",
        },
        words: [],
        endpointTerms: {
          start: "Problem",
          end: "Outcome",
        },
        lines: [lineEnter],
        bands: [],
      },
    },
    {
      id: "step-5-line-morph",
      timing: {
        durationMs: 1000,
        easing: "easeInOutCubic",
      },
      scene: {
        axes: {
          ...baseAxes,
          yVisible: true,
          xLabel: "Timeline",
          yLabel: "Code Effort",
        },
        words: [],
        endpointTerms: {
          start: "Problem",
          end: "Outcome",
        },
        lines: [lineMorphed],
        bands: [],
      },
    },
    {
      id: "step-6-bands-and-labels",
      timing: {
        durationMs: 900,
        easing: "easeInOutCubic",
      },
      scene: {
        axes: {
          ...baseAxes,
          yVisible: true,
          xLabel: "Timeline",
          yLabel: "Code Effort",
        },
        words: [],
        endpointTerms: {
          start: "Problem",
          end: "Outcome",
        },
        lines: [lineMorphed, supportLine],
        bands: [],
      },
    },
    {
      id: "step-7-band-reveal",
      timing: {
        durationMs: 850,
        easing: "easeOutCubic",
      },
      scene: {
        axes: {
          ...baseAxes,
          yVisible: true,
          xLabel: "Timeline",
          yLabel: "Code Effort",
        },
        words: [],
        endpointTerms: {
          start: "Problem",
          end: "Outcome",
        },
        lines: [lineMorphed, supportLine],
        bands: [
          {
            id: "band-gap-core-vs-support",
            upperLineId: "line-core-effort",
            lowerLineId: "line-support-load",
            fill: "#60a5fa",
            opacity: 0.25,
          },
        ],
      },
    },
  ],
};

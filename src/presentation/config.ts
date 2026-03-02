import type { PresentationConfig, WordDropItem } from "./types";

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
  ],
};

import type { BandState, LineState, SceneState, WordDropItem } from "../presentation/types";

export type EntityDiff = {
  entered: string[];
  updated: string[];
  exited: string[];
};

export type SceneDiff = {
  axisChanged: boolean;
  endpointTermsChanged: boolean;
  words: EntityDiff;
  lines: EntityDiff;
  bands: EntityDiff;
};

export function diffScenes(previous: SceneState, next: SceneState): SceneDiff {
  return {
    axisChanged: stableEqual(previous.axes, next.axes) === false,
    endpointTermsChanged: stableEqual(previous.endpointTerms, next.endpointTerms) === false,
    words: diffCollection(previous.words, next.words, (item) => item.id),
    lines: diffCollection(previous.lines, next.lines, (item) => item.id),
    bands: diffCollection(previous.bands, next.bands, (item) => item.id),
  };
}

export function summarizeDiff(diff: SceneDiff): string {
  return [
    `axis:${diff.axisChanged ? "changed" : "same"}`,
    `terms:${diff.endpointTermsChanged ? "changed" : "same"}`,
    `words(+${diff.words.entered.length}/~${diff.words.updated.length}/-${diff.words.exited.length})`,
    `lines(+${diff.lines.entered.length}/~${diff.lines.updated.length}/-${diff.lines.exited.length})`,
    `bands(+${diff.bands.entered.length}/~${diff.bands.updated.length}/-${diff.bands.exited.length})`,
  ].join(" | ");
}

function diffCollection<T extends WordDropItem | LineState | BandState>(
  previous: T[],
  next: T[],
  getId: (item: T) => string,
): EntityDiff {
  const previousMap = new Map(previous.map((item) => [getId(item), item] as const));
  const nextMap = new Map(next.map((item) => [getId(item), item] as const));

  const entered: string[] = [];
  const updated: string[] = [];
  const exited: string[] = [];

  for (const [id, nextItem] of nextMap) {
    const previousItem = previousMap.get(id);
    if (!previousItem) {
      entered.push(id);
      continue;
    }
    if (stableEqual(previousItem, nextItem) === false) {
      updated.push(id);
    }
  }

  for (const id of previousMap.keys()) {
    if (!nextMap.has(id)) {
      exited.push(id);
    }
  }

  return { entered, updated, exited };
}

function stableEqual<T>(left: T, right: T): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

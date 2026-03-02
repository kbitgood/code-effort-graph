import type { LineState, Vec2 } from "../presentation/types";

const EPSILON = 1e-6;

export type ProjectPoint = (point: Vec2) => Vec2;

export type LabelBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PlacedLineLabel = {
  lineId: string;
  text: string;
  position: Vec2;
  color: string;
};

type LabelCandidate = {
  lineId: string;
  text: string;
  basePosition: Vec2;
  manual: boolean;
  color: string;
};

type LabelPlacerOptions = {
  autoOffsetX?: number;
  autoOffsetY?: number;
  minHorizontalGap?: number;
  minVerticalGap?: number;
  nudgeStep?: number;
  maxNudges?: number;
  bounds?: LabelBounds;
  boundsPadding?: number;
};

export function placeLineLabels(
  lines: LineState[],
  project: ProjectPoint,
  options: LabelPlacerOptions = {},
): PlacedLineLabel[] {
  const autoOffsetX = options.autoOffsetX ?? 10;
  const autoOffsetY = options.autoOffsetY ?? -8;
  const minHorizontalGap = options.minHorizontalGap ?? 56;
  const minVerticalGap = options.minVerticalGap ?? 18;
  const nudgeStep = options.nudgeStep ?? 12;
  const maxNudges = options.maxNudges ?? 5;

  const candidates = lines
    .map((line) => toLabelCandidate(line, project, autoOffsetX, autoOffsetY))
    .filter((candidate): candidate is LabelCandidate => candidate !== null);

  const resolvedById = new Map<string, PlacedLineLabel>();
  const occupied: Vec2[] = [];

  for (const candidate of candidates.filter((item) => item.manual)) {
    const manualPosition = clampToBounds(candidate.basePosition, options.bounds, options.boundsPadding);
    resolvedById.set(candidate.lineId, {
      lineId: candidate.lineId,
      text: candidate.text,
      position: manualPosition,
      color: candidate.color,
    });
    occupied.push(manualPosition);
  }

  const autoCandidates = candidates
    .filter((item) => !item.manual)
    .sort((left, right) => left.basePosition.y - right.basePosition.y);

  for (const candidate of autoCandidates) {
    const resolved = resolveAutoLabelPosition(
      candidate.basePosition,
      occupied,
      minHorizontalGap,
      minVerticalGap,
      nudgeStep,
      maxNudges,
      options.bounds,
      options.boundsPadding,
    );

    resolvedById.set(candidate.lineId, {
      lineId: candidate.lineId,
      text: candidate.text,
      position: resolved,
      color: candidate.color,
    });
    occupied.push(resolved);
  }

  return lines
    .map((line) => resolvedById.get(line.id))
    .filter((label): label is PlacedLineLabel => label !== undefined);
}

function toLabelCandidate(
  line: LineState,
  project: ProjectPoint,
  autoOffsetX: number,
  autoOffsetY: number,
): LabelCandidate | null {
  if (!line.label.text) {
    return null;
  }

  if (line.label.mode === "manual" && line.label.position) {
    return {
      lineId: line.id,
      text: line.label.text,
      basePosition: project(line.label.position),
      manual: true,
      color: line.style.color,
    };
  }

  const endpoint = line.points[line.points.length - 1];
  if (!endpoint) {
    return null;
  }

  const endpointScreen = project({ x: endpoint.x, y: endpoint.y });
  return {
    lineId: line.id,
    text: line.label.text,
    basePosition: {
      x: endpointScreen.x + autoOffsetX,
      y: endpointScreen.y + autoOffsetY,
    },
    manual: false,
    color: line.style.color,
  };
}

function resolveAutoLabelPosition(
  basePosition: Vec2,
  occupied: Vec2[],
  minHorizontalGap: number,
  minVerticalGap: number,
  nudgeStep: number,
  maxNudges: number,
  bounds?: LabelBounds,
  boundsPadding?: number,
): Vec2 {
  const candidateOffsets = buildOffsets(maxNudges, nudgeStep);

  for (const offsetY of candidateOffsets) {
    const candidate = clampToBounds(
      { x: basePosition.x, y: basePosition.y + offsetY },
      bounds,
      boundsPadding,
    );
    if (hasCollision(candidate, occupied, minHorizontalGap, minVerticalGap) === false) {
      return candidate;
    }
  }

  return clampToBounds(basePosition, bounds, boundsPadding);
}

function buildOffsets(maxNudges: number, step: number): number[] {
  const offsets = [0];
  for (let i = 1; i <= maxNudges; i += 1) {
    offsets.push(-i * step, i * step);
  }
  return offsets;
}

function hasCollision(
  candidate: Vec2,
  occupied: Vec2[],
  minHorizontalGap: number,
  minVerticalGap: number,
): boolean {
  return occupied.some(
    (point) =>
      Math.abs(point.x - candidate.x) < minHorizontalGap - EPSILON &&
      Math.abs(point.y - candidate.y) < minVerticalGap - EPSILON,
  );
}

function clampToBounds(point: Vec2, bounds?: LabelBounds, padding = 6): Vec2 {
  if (!bounds) {
    return point;
  }

  return {
    x: Math.min(Math.max(point.x, bounds.x + padding), bounds.x + bounds.width - padding),
    y: Math.min(Math.max(point.y, bounds.y + padding), bounds.y + bounds.height - padding),
  };
}

import type { BandState, BezierPoint, LineState, Vec2 } from "../presentation/types";

const EPSILON = 1e-6;
const CURVE_SAMPLES_PER_SEGMENT = 24;
const LINEAR_SAMPLES_PER_SEGMENT = 6;

export type ProjectPoint = (point: Vec2) => Vec2;

export function buildBandPath(
  band: BandState,
  linesById: Map<string, LineState>,
  project: ProjectPoint,
): string | null {
  const upperLine = linesById.get(band.upperLineId);
  const lowerLine = linesById.get(band.lowerLineId);
  if (!upperLine || !lowerLine) {
    return null;
  }

  const hasRangeFilter = band.xMin !== undefined || band.xMax !== undefined;
  if (!hasRangeFilter) {
    return buildFullBandPath(upperLine.points, lowerLine.points, project);
  }

  const upperPoints = clipLineToRange(sampleLinePoints(upperLine.points), band.xMin, band.xMax);
  const lowerPoints = clipLineToRange(sampleLinePoints(lowerLine.points), band.xMin, band.xMax);
  if (upperPoints.length < 2 || lowerPoints.length < 2) {
    return null;
  }

  const screenOutline = [...upperPoints.map((point) => project(point)), ...[...lowerPoints].reverse().map(project)];
  if (screenOutline.length < 4) {
    return null;
  }

  return toClosedLinePath(screenOutline);
}

function buildFullBandPath(upperLine: BezierPoint[], lowerLine: BezierPoint[], project: ProjectPoint): string | null {
  const upperPath = toProjectedPathData(upperLine, project);
  const lowerReversePath = toProjectedReversePathData(lowerLine, project);
  if (!upperPath || !lowerReversePath) {
    return null;
  }

  return `${upperPath} ${lowerReversePath} Z`;
}

function sampleLinePoints(points: BezierPoint[]): Vec2[] {
  const [first, ...rest] = points;
  if (!first) {
    return [];
  }

  const sampled: Vec2[] = [{ x: first.x, y: first.y }];
  for (const [index, point] of rest.entries()) {
    const previous = points[index];
    if (!previous) continue;

    const hasCurve = Boolean(previous.cpOut || point.cpIn);
    if (hasCurve) {
      const p0 = { x: previous.x, y: previous.y };
      const p1 = previous.cpOut ?? p0;
      const p2 = point.cpIn ?? { x: point.x, y: point.y };
      const p3 = { x: point.x, y: point.y };
      for (let step = 1; step <= CURVE_SAMPLES_PER_SEGMENT; step += 1) {
        sampled.push(sampleCubicBezier(p0, p1, p2, p3, step / CURVE_SAMPLES_PER_SEGMENT));
      }
      continue;
    }

    for (let step = 1; step <= LINEAR_SAMPLES_PER_SEGMENT; step += 1) {
      sampled.push(lerpPoint(previous, point, step / LINEAR_SAMPLES_PER_SEGMENT));
    }
  }

  return sampled;
}

function clipLineToRange(points: Vec2[], xMin?: number, xMax?: number): Vec2[] {
  if (points.length === 0) {
    return [];
  }

  const lowerBound = xMin ?? Number.NEGATIVE_INFINITY;
  const upperBound = xMax ?? Number.POSITIVE_INFINITY;
  if (lowerBound > upperBound) {
    return [];
  }

  if (!Number.isFinite(lowerBound) && !Number.isFinite(upperBound)) {
    return points;
  }

  const clipped: Vec2[] = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const start = points[i];
    const end = points[i + 1];
    if (!start || !end) continue;

    const startInside = isInside(start.x, lowerBound, upperBound);
    const endInside = isInside(end.x, lowerBound, upperBound);

    if (startInside) {
      pushUnique(clipped, start);
    }

    if (Number.isFinite(lowerBound)) {
      const intersection = interpolateAtX(start, end, lowerBound);
      if (intersection && isInside(intersection.x, lowerBound, upperBound)) {
        pushUnique(clipped, intersection);
      }
    }

    if (Number.isFinite(upperBound)) {
      const intersection = interpolateAtX(start, end, upperBound);
      if (intersection && isInside(intersection.x, lowerBound, upperBound)) {
        pushUnique(clipped, intersection);
      }
    }

    if (endInside) {
      pushUnique(clipped, end);
    }
  }

  if (clipped.length === 0 && points[0] && isInside(points[0].x, lowerBound, upperBound)) {
    clipped.push(points[0]);
  }

  return clipped;
}

function sampleCubicBezier(p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2, t: number): Vec2 {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const t2 = t * t;
  const a = mt2 * mt;
  const b = 3 * mt2 * t;
  const c = 3 * mt * t2;
  const d = t2 * t;

  return {
    x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
    y: a * p0.y + b * p1.y + c * p2.y + d * p3.y,
  };
}

function toProjectedPathData(points: BezierPoint[], project: ProjectPoint): string | null {
  const [first, ...rest] = points;
  if (!first) {
    return null;
  }

  const firstScreen = project({ x: first.x, y: first.y });
  const commands: string[] = [`M ${firstScreen.x} ${firstScreen.y}`];

  for (const [index, point] of rest.entries()) {
    const previous = points[index];
    if (!previous) continue;

    const target = project({ x: point.x, y: point.y });
    const hasCurve = Boolean(previous.cpOut || point.cpIn);
    if (!hasCurve) {
      commands.push(`L ${target.x} ${target.y}`);
      continue;
    }

    const cpOut = previous.cpOut ?? { x: previous.x, y: previous.y };
    const cpIn = point.cpIn ?? { x: point.x, y: point.y };
    const cpOutScreen = project(cpOut);
    const cpInScreen = project(cpIn);
    commands.push(`C ${cpOutScreen.x} ${cpOutScreen.y}, ${cpInScreen.x} ${cpInScreen.y}, ${target.x} ${target.y}`);
  }

  return commands.join(" ");
}

function toProjectedReversePathData(points: BezierPoint[], project: ProjectPoint): string | null {
  if (points.length < 2) {
    return null;
  }

  const last = points[points.length - 1];
  if (!last) {
    return null;
  }

  const lastScreen = project({ x: last.x, y: last.y });
  const commands: string[] = [`L ${lastScreen.x} ${lastScreen.y}`];

  for (let index = points.length - 1; index > 0; index -= 1) {
    const from = points[index];
    const to = points[index - 1];
    if (!from || !to) continue;

    const target = project({ x: to.x, y: to.y });
    const hasCurve = Boolean(to.cpOut || from.cpIn);
    if (!hasCurve) {
      commands.push(`L ${target.x} ${target.y}`);
      continue;
    }

    const reverseCpOut = from.cpIn ?? { x: from.x, y: from.y };
    const reverseCpIn = to.cpOut ?? { x: to.x, y: to.y };
    const reverseCpOutScreen = project(reverseCpOut);
    const reverseCpInScreen = project(reverseCpIn);
    commands.push(
      `C ${reverseCpOutScreen.x} ${reverseCpOutScreen.y}, ${reverseCpInScreen.x} ${reverseCpInScreen.y}, ${target.x} ${target.y}`,
    );
  }

  return commands.join(" ");
}

function lerpPoint(start: Vec2, end: Vec2, t: number): Vec2 {
  return {
    x: start.x + (end.x - start.x) * t,
    y: start.y + (end.y - start.y) * t,
  };
}

function interpolateAtX(start: Vec2, end: Vec2, targetX: number): Vec2 | null {
  if (Math.abs(end.x - start.x) <= EPSILON) {
    return null;
  }

  const minX = Math.min(start.x, end.x);
  const maxX = Math.max(start.x, end.x);
  if (targetX < minX - EPSILON || targetX > maxX + EPSILON) {
    return null;
  }

  const ratio = (targetX - start.x) / (end.x - start.x);
  if (ratio < -EPSILON || ratio > 1 + EPSILON) {
    return null;
  }

  return {
    x: targetX,
    y: start.y + (end.y - start.y) * ratio,
  };
}

function isInside(x: number, lowerBound: number, upperBound: number): boolean {
  return x >= lowerBound - EPSILON && x <= upperBound + EPSILON;
}

function pushUnique(points: Vec2[], candidate: Vec2): void {
  const last = points[points.length - 1];
  if (!last) {
    points.push(candidate);
    return;
  }

  if (Math.abs(last.x - candidate.x) <= EPSILON && Math.abs(last.y - candidate.y) <= EPSILON) {
    return;
  }

  points.push(candidate);
}

function toClosedLinePath(points: Vec2[]): string {
  return `${points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ")} Z`;
}

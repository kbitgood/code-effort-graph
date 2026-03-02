import type { BezierPoint } from "../presentation/types";

type EasingName = "linear" | "easeInOutCubic" | "easeOutCubic";

type MorphOptions = {
  durationMs: number;
  easing: EasingName;
  buildPath: (points: BezierPoint[]) => string;
  shouldCancel?: () => boolean;
};

type DrawOptions = {
  durationMs: number;
  easing: EasingName;
  shouldCancel?: () => boolean;
};

export class LineAnimator {
  async animateDraw(path: SVGPathElement, options: DrawOptions): Promise<void> {
    const totalLength = path.getTotalLength();
    path.style.strokeDasharray = `${totalLength}`;
    path.style.strokeDashoffset = `${totalLength}`;

    await animateValue({
      durationMs: options.durationMs,
      easing: options.easing,
      shouldCancel: options.shouldCancel,
      onFrame: (progress) => {
        path.style.strokeDashoffset = String((1 - progress) * totalLength);
      },
    });

    path.style.strokeDasharray = "";
    path.style.strokeDashoffset = "";
  }

  async animateMorph(
    path: SVGPathElement,
    fromPoints: BezierPoint[],
    toPoints: BezierPoint[],
    options: MorphOptions,
  ): Promise<void> {
    if (fromPoints.length !== toPoints.length) {
      path.setAttribute("d", options.buildPath(toPoints));
      return;
    }

    await animateValue({
      durationMs: options.durationMs,
      easing: options.easing,
      shouldCancel: options.shouldCancel,
      onFrame: (progress) => {
        const current = interpolatePoints(fromPoints, toPoints, progress);
        path.setAttribute("d", options.buildPath(current));
      },
    });
  }
}

function interpolatePoints(fromPoints: BezierPoint[], toPoints: BezierPoint[], t: number): BezierPoint[] {
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

function interpolateMaybeVec2(
  from: { x: number; y: number } | undefined,
  to: { x: number; y: number } | undefined,
  t: number,
): { x: number; y: number } | undefined {
  if (!from && !to) return undefined;
  const fromPoint = from ?? to!;
  const toPoint = to ?? from!;
  return {
    x: lerp(fromPoint.x, toPoint.x, t),
    y: lerp(fromPoint.y, toPoint.y, t),
  };
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

async function animateValue(options: {
  durationMs: number;
  easing: EasingName;
  shouldCancel?: () => boolean;
  onFrame: (progress: number) => void;
}): Promise<void> {
  const easing = easingFunction(options.easing);
  const duration = Math.max(0, options.durationMs);
  if (duration === 0) {
    options.onFrame(1);
    return;
  }

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

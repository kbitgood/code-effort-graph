import type { PresentationStep } from "../presentation/types";
import { diffScenes, type SceneDiff } from "./diff";

export type TransitionDirection = "next" | "prev" | "reset" | "jump";

export type StepTransition = {
  fromIndex: number;
  toIndex: number;
  direction: TransitionDirection;
  previousStep: PresentationStep;
  step: PresentationStep;
  diff: SceneDiff;
};

type ControllerOptions = {
  onTransition: (transition: StepTransition) => void | Promise<void>;
};

export class PresentationController {
  private readonly steps: PresentationStep[];
  private readonly onTransition: ControllerOptions["onTransition"];
  private transitionLocked = false;

  public currentStepIndex = 0;

  constructor(steps: PresentationStep[], options: ControllerOptions) {
    if (steps.length === 0) {
      throw new Error("PresentationController requires at least one step.");
    }
    this.steps = steps;
    this.onTransition = options.onTransition;
  }

  get currentStep(): PresentationStep {
    return this.steps[this.currentStepIndex]!;
  }

  emitCurrent(): void {
    const step = this.currentStep;
    const diff = diffScenes(step.scene, step.scene);
    void this.onTransition({
      fromIndex: this.currentStepIndex,
      toIndex: this.currentStepIndex,
      direction: "jump",
      previousStep: step,
      step,
      diff,
    });
  }

  next(): boolean {
    return this.transitionTo(this.currentStepIndex + 1, "next");
  }

  prev(): boolean {
    return this.transitionTo(this.currentStepIndex - 1, "prev");
  }

  reset(): boolean {
    return this.transitionTo(0, "reset");
  }

  jumpTo(index: number): boolean {
    return this.transitionTo(index, "jump");
  }

  bindDefaultInputs(target: Document | HTMLElement = document): () => void {
    const keydownHandler: EventListener = (event) => {
      if (!(event instanceof KeyboardEvent)) return;
      if (event.defaultPrevented) return;

      if (event.key === "ArrowRight") {
        event.preventDefault();
        this.next();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        this.prev();
      } else if (event.code === "Space") {
        event.preventDefault();
        if (event.shiftKey) {
          this.prev();
        } else {
          this.next();
        }
      } else if (event.key === "Enter") {
        event.preventDefault();
        this.reset();
      } else if (event.key.toLowerCase() === "r") {
        event.preventDefault();
        this.reset();
      }
    };

    const clickHandler: EventListener = (event) => {
      if (!(event instanceof MouseEvent)) return;
      if (event.defaultPrevented) return;
      if (event.button !== 0) return;
      if (event.metaKey || event.altKey || event.ctrlKey || event.shiftKey) return;

      const targetElement = event.target as HTMLElement | null;
      if (targetElement?.closest("[data-nav-control],a,button,input,textarea,select,label")) {
        return;
      }
      this.next();
    };

    target.addEventListener("keydown", keydownHandler);
    target.addEventListener("click", clickHandler);

    return () => {
      target.removeEventListener("keydown", keydownHandler);
      target.removeEventListener("click", clickHandler);
    };
  }

  private transitionTo(targetIndex: number, direction: TransitionDirection): boolean {
    if (this.transitionLocked) return false;
    if (targetIndex < 0 || targetIndex >= this.steps.length) return false;

    const fromIndex = this.currentStepIndex;
    if (fromIndex === targetIndex && direction !== "reset") return false;

    const fromStep = this.steps[fromIndex];
    const toStep = this.steps[targetIndex];
    if (!fromStep || !toStep) {
      return false;
    }

    this.transitionLocked = true;
    try {
      const diff = diffScenes(fromStep.scene, toStep.scene);
      this.currentStepIndex = targetIndex;
      void Promise.resolve(
        this.onTransition({
          fromIndex,
          toIndex: targetIndex,
          direction,
          previousStep: fromStep,
          step: toStep,
          diff,
        }),
      ).finally(() => {
        this.transitionLocked = false;
      });
      return true;
    } catch (error) {
      this.transitionLocked = false;
      throw error;
    }
  }
}

import { presentationConfig } from "./presentation/config";
import { PresentationController } from "./core/controller";
import { SvgRenderer } from "./render/svg-renderer";
import { mountShaderBackground } from "./shader-background";

mountShaderBackground();

const app = document.querySelector<HTMLDivElement>("#app");

if (app) {
  app.replaceChildren();

  const chartHost = document.createElement("section");
  chartHost.className = "graph-scene";
  app.append(chartHost);

  const controls = document.createElement("div");
  controls.className = "nav-controls";
  app.append(controls);

  const prevButton = document.createElement("button");
  prevButton.type = "button";
  prevButton.className = "nav-button";
  prevButton.dataset.navControl = "prev";
  prevButton.textContent = "Prev";
  controls.append(prevButton);

  const nextButton = document.createElement("button");
  nextButton.type = "button";
  nextButton.className = "nav-button";
  nextButton.dataset.navControl = "next";
  nextButton.textContent = "Next";
  controls.append(nextButton);

  const resetButton = document.createElement("button");
  resetButton.type = "button";
  resetButton.className = "nav-button";
  resetButton.dataset.navControl = "reset";
  resetButton.textContent = "Reset";
  controls.append(resetButton);

  const fullscreenButton = document.createElement("button");
  fullscreenButton.type = "button";
  fullscreenButton.className = "nav-button";
  fullscreenButton.dataset.navControl = "fullscreen";
  fullscreenButton.textContent = "Fullscreen";
  controls.append(fullscreenButton);

  const renderer = new SvgRenderer(chartHost);
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const controller = new PresentationController(presentationConfig.steps, {
    onTransition: async ({ fromIndex, toIndex, previousStep, step, diff }) => {
      if (fromIndex === toIndex) {
        renderer.render(step.scene);
      } else {
        await renderer.transition(previousStep.scene, step.scene, diff, {
          durationMs: step.timing?.durationMs ?? presentationConfig.defaults.durationMs,
          easing: step.timing?.easing ?? presentationConfig.defaults.easing,
          reducedMotion: prefersReducedMotion,
        });
      }
    },
  });

  prevButton.addEventListener("click", () => controller.prev());
  nextButton.addEventListener("click", () => controller.next());
  resetButton.addEventListener("click", () => controller.reset());
  fullscreenButton.addEventListener("click", async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    await document.documentElement.requestFullscreen();
  });

  const syncFullscreenLabel = () => {
    fullscreenButton.textContent = document.fullscreenElement ? "Exit Fullscreen" : "Fullscreen";
  };
  document.addEventListener("fullscreenchange", syncFullscreenLabel);
  syncFullscreenLabel();

  controller.bindDefaultInputs(document);
  controller.emitCurrent();
}

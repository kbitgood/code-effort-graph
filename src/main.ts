import { presentationConfig } from "./presentation/config";
import { PresentationController } from "./core/controller";
import { SvgRenderer } from "./render/svg-renderer";
import { mountShaderBackground } from "./shader-background";
import skipIconSrc from "./assets/icons/skip.png";
import prevIconSrc from "./assets/icons/prev.png";
import nextIconSrc from "./assets/icons/next.png";
import fullscreenEnterIconSrc from "./assets/icons/fullscreen-enter.png";
import fullscreenExitIconSrc from "./assets/icons/fullscreen-exit.png";

mountShaderBackground();

const readSlideIndexFromUrl = (totalSlides: number): number => {
  const searchParams = new URL(window.location.href).searchParams;
  const raw = searchParams.get("slide");
  if (!raw) return 0;

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return 0;
  if (parsed < 1) return 0;
  if (parsed > totalSlides) return totalSlides - 1;
  return parsed - 1;
};

const writeSlideIndexToUrl = (slideIndex: number): void => {
  const url = new URL(window.location.href);
  const nextValue = String(slideIndex + 1);
  if (url.searchParams.get("slide") === nextValue) {
    return;
  }
  url.searchParams.set("slide", nextValue);
  window.history.replaceState(null, "", url);
};

const app = document.querySelector<HTMLDivElement>("#app");

if (app) {
  app.replaceChildren();

  const chartHost = document.createElement("section");
  chartHost.className = "graph-scene";
  app.append(chartHost);

  const controls = document.createElement("div");
  controls.className = "nav-controls";
  app.append(controls);

  const createNavIcon = (src: string, mirrored = false): HTMLImageElement => {
    const icon = document.createElement("img");
    icon.className = "nav-button-icon";
    icon.src = src;
    icon.alt = "";
    icon.ariaHidden = "true";
    if (mirrored) {
      icon.style.transform = "scaleX(-1)";
    }
    return icon;
  };

  const startButton = document.createElement("button");
  startButton.type = "button";
  startButton.className = "nav-button";
  startButton.dataset.navControl = "skip-start";
  startButton.ariaLabel = "Skip to beginning";
  startButton.title = "Skip to beginning";
  startButton.append(createNavIcon(skipIconSrc));
  controls.append(startButton);

  const prevButton = document.createElement("button");
  prevButton.type = "button";
  prevButton.className = "nav-button";
  prevButton.dataset.navControl = "prev";
  prevButton.ariaLabel = "Previous";
  prevButton.title = "Previous";
  prevButton.append(createNavIcon(prevIconSrc));
  controls.append(prevButton);

  const nextButton = document.createElement("button");
  nextButton.type = "button";
  nextButton.className = "nav-button";
  nextButton.dataset.navControl = "next";
  nextButton.ariaLabel = "Next";
  nextButton.title = "Next";
  nextButton.append(createNavIcon(nextIconSrc));
  controls.append(nextButton);

  const endButton = document.createElement("button");
  endButton.type = "button";
  endButton.className = "nav-button";
  endButton.dataset.navControl = "skip-end";
  endButton.ariaLabel = "Skip to end";
  endButton.title = "Skip to end";
  endButton.append(createNavIcon(skipIconSrc, true));
  controls.append(endButton);

  const fullscreenButton = document.createElement("button");
  fullscreenButton.type = "button";
  fullscreenButton.className = "nav-button";
  fullscreenButton.dataset.navControl = "fullscreen";
  fullscreenButton.ariaLabel = "Enter fullscreen";
  fullscreenButton.title = "Enter fullscreen";
  const fullscreenIcon = createNavIcon(fullscreenEnterIconSrc);
  fullscreenButton.append(fullscreenIcon);
  controls.append(fullscreenButton);

  const renderer = new SvgRenderer(chartHost);
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const totalSlides = presentationConfig.steps.length;
  const initialSlideIndex = readSlideIndexFromUrl(totalSlides);
  const controller = new PresentationController(presentationConfig.steps, {
    onTransition: async ({ fromIndex, toIndex, previousStep, step, diff }) => {
      writeSlideIndexToUrl(toIndex);
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

  startButton.addEventListener("click", () => controller.reset());
  prevButton.addEventListener("click", () => controller.prev());
  nextButton.addEventListener("click", () => controller.next());
  endButton.addEventListener("click", () => controller.emitImmediate(presentationConfig.steps.length - 1));
  fullscreenButton.addEventListener("click", async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    await document.documentElement.requestFullscreen();
  });

  const syncFullscreenLabel = () => {
    const isFullscreen = Boolean(document.fullscreenElement);
    fullscreenIcon.src = isFullscreen ? fullscreenExitIconSrc : fullscreenEnterIconSrc;
    fullscreenButton.ariaLabel = isFullscreen ? "Exit fullscreen" : "Enter fullscreen";
    fullscreenButton.title = isFullscreen ? "Exit fullscreen" : "Enter fullscreen";
  };
  document.addEventListener("fullscreenchange", syncFullscreenLabel);
  syncFullscreenLabel();

  controller.bindDefaultInputs(document);
  controller.emitImmediate(initialSlideIndex);
}

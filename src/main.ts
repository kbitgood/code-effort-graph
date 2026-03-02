import { presentationConfig } from "./presentation/config";
import { PresentationController } from "./core/controller";
import { summarizeDiff } from "./core/diff";
import { LAYER_ORDER, SvgRenderer } from "./render/svg-renderer";

const app = document.querySelector<HTMLDivElement>("#app");

if (app) {
  const status = document.createElement("p");
  status.textContent = "Browser entry loaded from src/main.ts";
  status.style.marginTop = "16px";
  status.style.color = "#0f172a";
  status.style.fontWeight = "600";
  app.append(status);

  const step2 = document.createElement("p");
  step2.textContent = `Step 2 complete: ${presentationConfig.steps.length} typed presentation steps configured.`;
  step2.style.marginTop = "8px";
  step2.style.color = "#1d4ed8";
  step2.style.fontWeight = "600";
  app.append(step2);

  const ids = document.createElement("p");
  ids.textContent = `Step IDs: ${presentationConfig.steps.map((step) => step.id).join(", ")}`;
  ids.style.marginTop = "8px";
  ids.style.color = "#334155";
  ids.style.fontSize = "0.95rem";
  app.append(ids);

  const controls = document.createElement("div");
  controls.style.display = "flex";
  controls.style.gap = "8px";
  controls.style.marginTop = "14px";
  controls.style.alignItems = "center";
  app.append(controls);

  const prevButton = document.createElement("button");
  prevButton.type = "button";
  prevButton.dataset.navControl = "prev";
  prevButton.textContent = "Prev";
  styleButton(prevButton);
  controls.append(prevButton);

  const nextButton = document.createElement("button");
  nextButton.type = "button";
  nextButton.dataset.navControl = "next";
  nextButton.textContent = "Next";
  styleButton(nextButton);
  controls.append(nextButton);

  const resetButton = document.createElement("button");
  resetButton.type = "button";
  resetButton.dataset.navControl = "reset";
  resetButton.textContent = "Reset";
  styleButton(resetButton);
  controls.append(resetButton);

  const stepMeta = document.createElement("span");
  stepMeta.style.marginLeft = "6px";
  stepMeta.style.fontWeight = "600";
  stepMeta.style.color = "#0f172a";
  controls.append(stepMeta);

  const diffMeta = document.createElement("p");
  diffMeta.style.marginTop = "10px";
  diffMeta.style.color = "#334155";
  diffMeta.style.fontSize = "0.9rem";
  app.append(diffMeta);

  const chartHost = document.createElement("section");
  chartHost.style.marginTop = "20px";
  chartHost.style.width = "100%";
  app.append(chartHost);

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

      stepMeta.textContent = `Step ${toIndex + 1} / ${presentationConfig.steps.length}: ${step.id}`;
      diffMeta.textContent = `Diff: ${summarizeDiff(diff)}`;
    },
  });

  const step3 = document.createElement("p");
  step3.textContent = `Step 3 complete: static SVG renderer with layers (${LAYER_ORDER.join(", ")})`;
  step3.style.marginTop = "12px";
  step3.style.color = "#065f46";
  step3.style.fontWeight = "600";
  app.append(step3);

  const step4 = document.createElement("p");
  step4.textContent = "Step 4 complete: diff engine + navigation controller (click, ←/→, R).";
  step4.style.marginTop = "8px";
  step4.style.color = "#7c2d12";
  step4.style.fontWeight = "600";
  app.append(step4);

  const step5 = document.createElement("p");
  step5.textContent = "Step 5 complete: line draw-on-enter and line morph animation are enabled.";
  step5.style.marginTop = "8px";
  step5.style.color = "#14532d";
  step5.style.fontWeight = "600";
  app.append(step5);

  const controlsHint = document.createElement("p");
  controlsHint.textContent =
    "Controls: click anywhere to advance, ArrowLeft/ArrowRight or Space/Shift+Space to navigate, Enter/R to reset.";
  controlsHint.style.marginTop = "8px";
  controlsHint.style.fontSize = "0.95rem";
  controlsHint.style.color = "#475569";
  app.append(controlsHint);

  prevButton.addEventListener("click", () => controller.prev());
  nextButton.addEventListener("click", () => controller.next());
  resetButton.addEventListener("click", () => controller.reset());

  controller.bindDefaultInputs(document);
  controller.emitCurrent();
}

function styleButton(button: HTMLButtonElement): void {
  button.style.border = "1px solid #94a3b8";
  button.style.background = "#f8fafc";
  button.style.color = "#0f172a";
  button.style.padding = "6px 10px";
  button.style.borderRadius = "8px";
  button.style.fontWeight = "600";
  button.style.cursor = "pointer";
}

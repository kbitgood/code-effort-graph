import { presentationConfig } from "./presentation/config";
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

  const chartHost = document.createElement("section");
  chartHost.style.marginTop = "20px";
  chartHost.style.width = "100%";
  app.append(chartHost);

  const initialStep = presentationConfig.steps[0];
  if (initialStep) {
    const renderer = new SvgRenderer(chartHost);
    renderer.render(initialStep.scene);
  }

  const step3 = document.createElement("p");
  step3.textContent = `Step 3 complete: static SVG renderer with layers (${LAYER_ORDER.join(", ")})`;
  step3.style.marginTop = "12px";
  step3.style.color = "#065f46";
  step3.style.fontWeight = "600";
  app.append(step3);
}

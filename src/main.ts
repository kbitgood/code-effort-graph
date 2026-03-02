import { presentationConfig } from "./presentation/config";

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
}

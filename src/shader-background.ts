import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { FilmGrain, Shader, Swirl, WaveDistortion } from "shaders/react";

export function mountShaderBackground(): void {
  const host = document.querySelector<HTMLDivElement>("#shader-background");
  if (!host) {
    return;
  }

  createRoot(host).render(
    createElement(
      Shader,
      {
        colorSpace: "srgb",
        style: {
          width: "100%",
          height: "100%",
        },
      },
      createElement(Swirl, {
        blend: 50,
        speed: 0.3,
        colorA: "#dbe9ff",
        colorB: "#f5f9ff",
        detail: 1.6,
        opacity: 1,
        maskType: "alpha",
        blendMode: "normal",
        transform: {
          edges: "transparent",
          scale: 1,
          anchorX: 0.5,
          anchorY: 0.5,
          offsetX: 0,
          offsetY: 0,
          rotation: 0,
        },
        colorSpace: "oklch",
      }),
      createElement(WaveDistortion, {
        angle: 133,
        edges: "mirror",
        speed: 0.8,
        opacity: 1,
        visible: true,
        maskType: "alpha",
        strength: 0.1,
        waveType: "sine",
        blendMode: "normal",
        frequency: 1.6,
        transform: {
          edges: "transparent",
          scale: 1,
          anchorX: 0.5,
          anchorY: 0.5,
          offsetX: 0,
          offsetY: 0,
          rotation: 0,
        },
      }),
      createElement(FilmGrain, {
        opacity: 1,
        strength: 0.15,
        blendMode: "normal",
      }),
    ),
  );
}

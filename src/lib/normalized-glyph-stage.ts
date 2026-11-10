// SPDX-License-Identifier: Apache-2.0
import { normalizeOutline, sharedViewBox } from "../../tools/geometry.mjs";
import type { GlyphOutline, Metrics } from "../../tools/content.mjs";

const svgNamespace = "http://www.w3.org/2000/svg";

export interface NormalizedGlyphLayer {
  outline: GlyphOutline;
  label: string;
  color: string;
  metrics: Metrics | null;
}

export interface NormalizedGlyphStageOptions {
  mode: "side-by-side" | "overlay";
  opacity: number;
  showBaseline: boolean;
  showXHeight: boolean;
  showBounds: boolean;
  overlayLabel: string;
}

function svgElement(name: string, attributes: Record<string, string> = {}) {
  const element = document.createElementNS(svgNamespace, name);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
  return element;
}

function makeFigure(layers: NormalizedGlyphLayer[], geometry: ReturnType<typeof normalizeOutline>[], index: number, viewBox: ReturnType<typeof sharedViewBox>, options: NormalizedGlyphStageOptions) {
  const figure = document.createElement("figure");
  figure.className = "comparison-figure";
  const svg = svgElement("svg", {
    viewBox: `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`,
    role: "img",
    "aria-label": layers.map(({ label }) => label).join("; "),
    focusable: "false",
  });
  const title = svgElement("title");
  title.textContent = layers.map(({ label }) => label).join(" / ");
  svg.append(title);

  const world = svgElement("g", { transform: "scale(1 -1)" });
  const guideAttributes = { "stroke-width": "0.012", "vector-effect": "non-scaling-stroke" };
  if (options.showBaseline) world.append(svgElement("line", {
    x1: String(viewBox.world.minX), x2: String(viewBox.world.maxX), y1: "0", y2: "0",
    stroke: "#344054", "data-guide": "baseline", ...guideAttributes,
  }));
  if (options.showXHeight) world.append(svgElement("line", {
    x1: String(viewBox.world.minX), x2: String(viewBox.world.maxX), y1: "1", y2: "1",
    stroke: "#64748b", "stroke-dasharray": "0.06 0.04", "data-guide": "x-height", ...guideAttributes,
  }));

  const first = options.mode === "overlay" ? 0 : index;
  const last = options.mode === "overlay" ? layers.length : index + 1;
  for (let layerIndex = first; layerIndex < last; layerIndex += 1) {
    const layer = layers[layerIndex];
    const shape = geometry[layerIndex];
    if (options.showBounds) world.append(svgElement("rect", {
      x: String(shape.bounds.minX),
      y: String(shape.bounds.minY),
      width: String(shape.bounds.maxX - shape.bounds.minX),
      height: String(shape.bounds.maxY - shape.bounds.minY),
      fill: "none",
      stroke: layer.color,
      "stroke-width": "0.012",
      "vector-effect": "non-scaling-stroke",
    }));
    world.append(svgElement("path", {
      d: layer.outline.path,
      transform: shape.transform,
      fill: layer.color,
      "fill-rule": layer.outline.fill_rule ?? "nonzero",
      "fill-opacity": options.mode === "overlay" && layerIndex === 1 ? String(options.opacity) : "1",
    }));
  }
  svg.append(world);
  figure.append(svg);
  const caption = document.createElement("figcaption");
  caption.textContent = options.mode === "overlay" ? options.overlayLabel : layers[index].label;
  figure.append(caption);
  return figure;
}

export function renderNormalizedGlyphStage(container: HTMLElement, layers: NormalizedGlyphLayer[], options: NormalizedGlyphStageOptions) {
  if (layers.length === 0) {
    container.replaceChildren();
    return;
  }
  const geometry = layers.map(({ outline }) => normalizeOutline(outline));
  const metrics = layers.flatMap(({ metrics }) => metrics ? [metrics] : []);
  const viewBox = sharedViewBox(geometry, metrics);
  const count = options.mode === "overlay" ? 1 : layers.length;
  const figures = Array.from({ length: count }, (_, index) => makeFigure(layers, geometry, index, viewBox, options));
  container.replaceChildren(...figures);
}

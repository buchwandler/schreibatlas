// SPDX-License-Identifier: Apache-2.0
import { fontSizeForXHeight, sharedViewBox } from "../../tools/geometry.mjs";
import type { Metrics } from "../../tools/content.mjs";
import type { ShapedRun } from "./text-shaper";

export interface NormalizedTextLayer {
  run: ShapedRun;
  modelName: string;
  fontName: string;
  xHeightEm: number;
  metrics: Metrics | null;
  color: string;
}

export interface NormalizedTextStageOptions {
  mode: "side-by-side" | "overlay";
  opacity: number;
  showBaseline: boolean;
  showXHeight: boolean;
  overlayLabel: string;
}

const svgNamespace = "http://www.w3.org/2000/svg";

const lineSpacing = 1.5;
function svgElement(name: string, attributes: Record<string, string> = {}) {
  const element = document.createElementNS(svgNamespace, name);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
  return element;
}

function textBounds(layer: NormalizedTextLayer) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas text metrics are unavailable.");
  const fontSize = fontSizeForXHeight(layer.xHeightEm);
  context.font = `${fontSize}px "${layer.run.fontFamily}"`;
  context.direction = layer.run.direction ?? "ltr";
  context.textAlign = "start";
  const lines = layer.run.text.split(/\r\n?|\n/);
  const bounds = lines.map((line, index) => {
    const metrics = context.measureText(line);
    const left = Number.isFinite(metrics.actualBoundingBoxLeft) ? metrics.actualBoundingBoxLeft : 0;
    const right = Number.isFinite(metrics.actualBoundingBoxRight) ? metrics.actualBoundingBoxRight : metrics.width;
    const ascent = Number.isFinite(metrics.actualBoundingBoxAscent) ? metrics.actualBoundingBoxAscent : 1;
    const descent = Number.isFinite(metrics.actualBoundingBoxDescent) ? metrics.actualBoundingBoxDescent : 0;
    const offset = index * lineSpacing;
    return { minX: -left, maxX: right, minY: -descent - offset, maxY: ascent - offset };
  });
  return {
    minX: Math.min(...bounds.map(({ minX }) => minX)),
    maxX: Math.max(...bounds.map(({ maxX }) => maxX)),
    minY: Math.min(...bounds.map(({ minY }) => minY)),
    maxY: Math.max(...bounds.map(({ maxY }) => maxY)),
  };
}

function makeFigure(layers: NormalizedTextLayer[], index: number, viewBox: ReturnType<typeof sharedViewBox>, options: NormalizedTextStageOptions) {
  const figure = document.createElement("figure");
  figure.className = "comparison-figure";
  const svg = svgElement("svg", {
    viewBox: `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`,
    role: "img",
    "aria-label": layers.map(({ modelName, run }) => `${modelName}: ${run.text}`).join("; "),
    focusable: "false",
  });
  const title = svgElement("title");
  title.textContent = layers.map(({ modelName }) => modelName).join(" / ");
  svg.append(title);

  const world = svgElement("g", { transform: "scale(1 -1)" });
  const lineAttributes = { x1: String(viewBox.world.minX), x2: String(viewBox.world.maxX), "stroke-width": "0.012", "vector-effect": "non-scaling-stroke" };
  if (options.showBaseline) world.append(svgElement("line", { ...lineAttributes, y1: "0", y2: "0", stroke: "#344054", "data-guide": "baseline" }));
  if (options.showXHeight) world.append(svgElement("line", { ...lineAttributes, y1: "1", y2: "1", stroke: "#64748b", "stroke-dasharray": "0.06 0.04", "data-guide": "x-height" }));

  const first = options.mode === "overlay" ? 0 : index;
  const last = options.mode === "overlay" ? layers.length : index + 1;
  for (let layerIndex = first; layerIndex < last; layerIndex += 1) {
    const layer = layers[layerIndex];
    const fontSize = fontSizeForXHeight(layer.xHeightEm);
    layer.run.text.split(/\r\n?|\n/).forEach((line, lineIndex) => {
      const text = svgElement("text", {
        x: "0",
        y: String(-lineIndex * lineSpacing),
        "data-text-line": String(lineIndex),
        "font-family": layer.run.fontFamily,
        "font-size": String(fontSize),
        "font-kerning": "normal",
        direction: layer.run.direction ?? "ltr",
        "text-anchor": layer.run.direction === "rtl" ? "end" : "start",
        "fill": layer.color,
        "fill-opacity": options.mode === "overlay" && layerIndex === 1 ? String(options.opacity) : "1",
        lang: layer.run.language ?? "",
      });
      text.style.fontFeatureSettings = (layer.run.features ?? ["calt", "kern"]).map((tag) => `"${tag}" 1`).join(", ");
      text.textContent = line;
      world.append(text);
    });
  }
  svg.append(world);
  figure.append(svg);
  const caption = document.createElement("figcaption");
  caption.textContent = options.mode === "overlay" ? options.overlayLabel : `${layers[index].modelName} · ${layers[index].fontName}`;
  figure.append(caption);
  return figure;
}

export function renderNormalizedTextStage(container: HTMLElement, layers: NormalizedTextLayer[], options: NormalizedTextStageOptions) {
  if (layers.length === 0) {
    container.replaceChildren();
    return;
  }
  const normalized = layers.map((layer) => ({ transform: "", bounds: textBounds(layer) }));
  const metrics = layers.flatMap(({ metrics }) => metrics ? [metrics] : []);
  const viewBox = sharedViewBox(normalized, metrics);
  const count = options.mode === "overlay" ? 1 : layers.length;
  const figures = Array.from({ length: count }, (_, index) => makeFigure(layers, index, viewBox, options));
  container.replaceChildren(...figures);
}

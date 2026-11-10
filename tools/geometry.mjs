// SPDX-License-Identifier: Apache-2.0
export function normalizePoint(outline, x, y) {
  const height = outline.baseline - outline.x_height;
  if (height <= 0) throw new Error("Outline baseline must be below its x-height in SVG coordinates.");
  const scale = 1 / height;
  return {
    x: (x - outline.view_box[0]) * scale,
    y: (outline.baseline - y) * scale,
  };
}

export function fontSizeForXHeight(xHeightEm) {
  if (xHeightEm <= 0) throw new Error("Font x-height calibration must be positive.");
  return 1 / xHeightEm;
}

export function normalizeOutline(outline) {
  const height = outline.baseline - outline.x_height;
  if (height <= 0) throw new Error("Outline baseline must be below its x-height in SVG coordinates.");
  const scale = 1 / height;
  const [x, y, width, boxHeight] = outline.view_box;
  return {
    transform: `translate(${-x * scale} ${outline.baseline * scale}) scale(${scale} ${-scale})`,
    bounds: {
      minX: 0,
      maxX: width * scale,
      minY: (outline.baseline - y - boxHeight) * scale,
      maxY: (outline.baseline - y) * scale,
    },
  };
}

export function sharedViewBox(normalizedOutlines, metrics = []) {
  if (!normalizedOutlines.length) throw new Error("At least one normalized outline is required.");
  const minX = Math.min(...normalizedOutlines.map(({ bounds }) => bounds.minX));
  const maxX = Math.max(...normalizedOutlines.map(({ bounds }) => bounds.maxX));
  const metricLines = metrics.flatMap(({ ascender, descender }) => [ascender, descender]);
  const verticalValues = [0, 1, ...metricLines.filter(Number.isFinite), ...normalizedOutlines.flatMap(({ bounds }) => [bounds.minY, bounds.maxY])];
  const minY = Math.min(...verticalValues);
  const maxY = Math.max(...verticalValues);
  const padding = Math.max((maxX - minX) * 0.05, 0.08);
  const left = minX - padding;
  const right = maxX + padding;
  const top = maxY + padding;
  const bottom = minY - padding;
  return {
    x: left,
    y: -top,
    width: right - left,
    height: top - bottom,
    world: { minX: left, maxX: right, minY: bottom, maxY: top },
  };
}

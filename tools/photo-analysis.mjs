// SPDX-License-Identifier: Apache-2.0
const maxOutputPixels = 3_000_000;
const maxOutputDimension = 2600;

export function isValidQuadrilateral(corners, width, height) {
  if (!Array.isArray(corners) || corners.length !== 4 || width < 2 || height < 2) return false;
  if (corners.some(({ x, y }) => !Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x > width - 1 || y > height - 1)) return false;
  const crosses = corners.map((point, index) => {
    const next = corners[(index + 1) % 4];
    const after = corners[(index + 2) % 4];
    return (next.x - point.x) * (after.y - next.y) - (next.y - point.y) * (after.x - next.x);
  });
  if (crosses.some((cross) => cross <= 0)) return false;
  const area = Math.abs(corners.reduce((sum, point, index) => {
    const next = corners[(index + 1) % 4];
    return sum + point.x * next.y - next.x * point.y;
  }, 0)) / 2;
  return area >= 4;
}

function distance(first, second) {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function outputSize(corners, targetSizeMm) {
  const width = Math.max(distance(corners[0], corners[1]), distance(corners[3], corners[2]));
  const height = Math.max(distance(corners[0], corners[3]), distance(corners[1], corners[2]));
  if (targetSizeMm && Number.isFinite(targetSizeMm.width) && Number.isFinite(targetSizeMm.height) && targetSizeMm.width > 0 && targetSizeMm.height > 0) {
    const scale = Math.min(
      1,
      width / targetSizeMm.width,
      height / targetSizeMm.height,
      maxOutputDimension / targetSizeMm.width,
      maxOutputDimension / targetSizeMm.height,
      Math.sqrt(maxOutputPixels / (targetSizeMm.width * targetSizeMm.height)),
    );
    return {
      width: Math.max(2, Math.round(targetSizeMm.width * scale)),
      height: Math.max(2, Math.round(targetSizeMm.height * scale)),
    };
  }
  const scale = Math.min(1, maxOutputDimension / width, maxOutputDimension / height, Math.sqrt(maxOutputPixels / (width * height)));
  return {
    width: Math.max(2, Math.round(width * scale) + 1),
    height: Math.max(2, Math.round(height * scale) + 1),
  };
}

function unitSquareTransform(corners) {
  const [first, second, third, fourth] = corners;
  const dx1 = second.x - third.x;
  const dx2 = fourth.x - third.x;
  const dx3 = first.x - second.x + third.x - fourth.x;
  const dy1 = second.y - third.y;
  const dy2 = fourth.y - third.y;
  const dy3 = first.y - second.y + third.y - fourth.y;
  let g = 0;
  let h = 0;
  if (Math.abs(dx3) > 1e-8 || Math.abs(dy3) > 1e-8) {
    const denominator = dx1 * dy2 - dx2 * dy1;
    if (Math.abs(denominator) < 1e-8) throw new Error("Crop corners do not define a usable perspective transform.");
    g = (dx3 * dy2 - dx2 * dy3) / denominator;
    h = (dx1 * dy3 - dx3 * dy1) / denominator;
  }
  return {
    a: second.x - first.x + g * second.x,
    b: fourth.x - first.x + h * fourth.x,
    c: first.x,
    d: second.y - first.y + g * second.y,
    e: fourth.y - first.y + h * fourth.y,
    f: first.y,
    g,
    h,
  };
}

function warpRgba(source, sourceWidth, sourceHeight, corners, width, height) {
  const transform = unitSquareTransform(corners);
  const output = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const v = y / (height - 1);
    for (let x = 0; x < width; x += 1) {
      const u = x / (width - 1);
      const divisor = transform.g * u + transform.h * v + 1;
      const sourceX = (transform.a * u + transform.b * v + transform.c) / divisor;
      const sourceY = (transform.d * u + transform.e * v + transform.f) / divisor;
      const target = (y * width + x) * 4;
      if (sourceX < 0 || sourceY < 0 || sourceX > sourceWidth - 1 || sourceY > sourceHeight - 1) {
        output[target] = 255;
        output[target + 1] = 255;
        output[target + 2] = 255;
        output[target + 3] = 255;
        continue;
      }
      const left = Math.floor(sourceX);
      const top = Math.floor(sourceY);
      const right = Math.min(sourceWidth - 1, left + 1);
      const bottom = Math.min(sourceHeight - 1, top + 1);
      const xRatio = sourceX - left;
      const yRatio = sourceY - top;
      const topLeft = (top * sourceWidth + left) * 4;
      const topRight = (top * sourceWidth + right) * 4;
      const bottomLeft = (bottom * sourceWidth + left) * 4;
      const bottomRight = (bottom * sourceWidth + right) * 4;
      for (let channel = 0; channel < 3; channel += 1) {
        const upper = source[topLeft + channel] * (1 - xRatio) + source[topRight + channel] * xRatio;
        const lower = source[bottomLeft + channel] * (1 - xRatio) + source[bottomRight + channel] * xRatio;
        const alpha = source[topLeft + 3] * (1 - xRatio) * (1 - yRatio)
          + source[topRight + 3] * xRatio * (1 - yRatio)
          + source[bottomLeft + 3] * (1 - xRatio) * yRatio
          + source[bottomRight + 3] * xRatio * yRatio;
        output[target + channel] = (upper * (1 - yRatio) + lower * yRatio) * (alpha / 255) + 255 * (1 - alpha / 255);
      }
      output[target + 3] = 255;
    }
  }
  return output;
}

function grayscale(rgba) {
  const gray = new Uint8Array(rgba.length / 4);
  const histogram = new Uint32Array(256);
  for (let pixel = 0; pixel < gray.length; pixel += 1) {
    const offset = pixel * 4;
    const value = Math.round(rgba[offset] * 0.299 + rgba[offset + 1] * 0.587 + rgba[offset + 2] * 0.114);
    gray[pixel] = value;
    histogram[value] += 1;
  }
  return { gray, histogram };
}

function otsuThreshold(histogram) {
  let firstLevel = -1;
  let lastLevel = -1;
  for (let value = 0; value < histogram.length; value += 1) {
    if (histogram[value]) {
      if (firstLevel < 0) firstLevel = value;
      lastLevel = value;
    }
  }
  if (firstLevel < 0 || firstLevel === lastLevel) return null;

  const total = histogram.reduce((sum, count) => sum + count, 0);
  let totalIntensity = 0;
  for (let value = 0; value < 256; value += 1) totalIntensity += value * histogram[value];
  let backgroundCount = 0;
  let backgroundIntensity = 0;
  let maximumVariance = -1;
  let threshold = 127;
  for (let value = 0; value < 256; value += 1) {
    backgroundCount += histogram[value];
    if (!backgroundCount) continue;
    const foregroundCount = total - backgroundCount;
    if (!foregroundCount) break;
    backgroundIntensity += value * histogram[value];
    const backgroundMean = backgroundIntensity / backgroundCount;
    const foregroundMean = (totalIntensity - backgroundIntensity) / foregroundCount;
    const variance = backgroundCount * foregroundCount * (backgroundMean - foregroundMean) ** 2;
    if (variance > maximumVariance) {
      maximumVariance = variance;
      threshold = value;
    }
  }
  return threshold;
}

function makeMask(gray, threshold) {
  const mask = new Uint8Array(gray.length);
  for (let index = 0; index < gray.length; index += 1) mask[index] = gray[index] <= threshold ? 1 : 0;
  return mask;
}

function estimateDeskew(mask, width, height) {
  const stride = Math.max(1, Math.floor(mask.length / 50000));
  const points = [];
  for (let index = 0; index < mask.length; index += stride) {
    if (mask[index]) points.push({ x: index % width, y: Math.floor(index / width) });
  }
  if (points.length < 40) return { degrees: 0, confidence: "low" };

  const centerX = (width - 1) / 2;
  const margin = Math.ceil(width * Math.sin(7 * Math.PI / 180)) + 3;
  const bins = height + margin * 2;
  let bestScore = -1;
  let bestDegrees = 0;
  let straightScore = 0;
  for (let step = -14; step <= 14; step += 1) {
    const degrees = step * 0.5;
    const angle = degrees * Math.PI / 180;
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    const projection = new Uint32Array(bins);
    for (const point of points) {
      const row = Math.floor(point.y * cosine - (point.x - centerX) * sine) + margin;
      if (row >= 0 && row < bins) projection[row] += 1;
    }
    let score = 0;
    for (const count of projection) score += count * count;
    if (degrees === 0) straightScore = score;
    if (score > bestScore) {
      bestScore = score;
      bestDegrees = degrees;
    }
  }
  const concentration = bestScore / points.length;
  const improvement = straightScore > 0 ? bestScore / straightScore : 1;
  return {
    degrees: concentration >= 2 && improvement >= 1.01 ? bestDegrees : 0,
    confidence: points.length >= 300 && concentration >= 5 && improvement >= 1.08 ? "medium" : "low",
  };
}

function rotateRgba(source, width, height, degrees) {
  if (Math.abs(degrees) < 0.05) return source;
  const output = new Uint8ClampedArray(source.length);
  const cosine = Math.cos(degrees * Math.PI / 180);
  const sine = Math.sin(degrees * Math.PI / 180);
  const centerX = (width - 1) / 2;
  const centerY = (height - 1) / 2;
  for (let y = 0; y < height; y += 1) {
    const dy = y - centerY;
    for (let x = 0; x < width; x += 1) {
      const dx = x - centerX;
      const sourceX = Math.round(centerX + dx * cosine - dy * sine);
      const sourceY = Math.round(centerY + dx * sine + dy * cosine);
      const target = (y * width + x) * 4;
      if (sourceX < 0 || sourceY < 0 || sourceX >= width || sourceY >= height) {
        output[target] = 255;
        output[target + 1] = 255;
        output[target + 2] = 255;
        output[target + 3] = 255;
      } else {
        const origin = (sourceY * width + sourceX) * 4;
        output[target] = source[origin];
        output[target + 1] = source[origin + 1];
        output[target + 2] = source[origin + 2];
        output[target + 3] = source[origin + 3];
      }
    }
  }
  return output;
}

function detectLines(mask, width, height) {
  const rowCounts = new Uint32Array(height);
  for (let index = 0; index < mask.length; index += 1) if (mask[index]) rowCounts[Math.floor(index / width)] += 1;
  const maximum = Math.max(...rowCounts);
  if (!maximum) return [];
  const rowThreshold = Math.max(2, Math.floor(maximum * 0.015));
  const rows = [];
  let start = -1;
  let last = -1;
  for (let y = 0; y < height; y += 1) {
    if (rowCounts[y] < rowThreshold) continue;
    if (start < 0) start = y;
    if (last >= 0 && y - last > 3) {
      rows.push([start, last]);
      start = y;
    }
    last = y;
  }
  if (start >= 0) rows.push([start, last]);

  const lines = [];
  for (const [top, bottom] of rows) {
    if (bottom - top + 1 < 3) continue;
    let minX = width;
    let maxX = -1;
    let inkPixels = 0;
    const bottomByColumn = new Int32Array(width).fill(-1);
    for (let y = top; y <= bottom; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (!mask[y * width + x]) continue;
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        bottomByColumn[x] = y;
        inkPixels += 1;
      }
    }
    if (maxX < minX || inkPixels < Math.max(8, maximum * 2)) continue;
    const lineWidth = maxX - minX + 1;
    const binCount = Math.min(40, Math.max(1, Math.floor(lineWidth / 4)));
    const bins = Array.from({ length: binCount }, () => []);
    for (let x = minX; x <= maxX; x += 1) {
      if (bottomByColumn[x] < 0) continue;
      const bin = Math.min(binCount - 1, Math.floor((x - minX) / lineWidth * binCount));
      bins[bin].push(bottomByColumn[x]);
    }
    const fitPoints = bins.flatMap((values, index) => values.length
      ? [{ x: minX + (index + 0.5) * lineWidth / binCount, y: values.reduce((sum, value) => sum + value, 0) / values.length }]
      : []);
    const meanX = fitPoints.reduce((sum, point) => sum + point.x, 0) / Math.max(1, fitPoints.length);
    const meanY = fitPoints.reduce((sum, point) => sum + point.y, 0) / Math.max(1, fitPoints.length);
    const denominator = fitPoints.reduce((sum, point) => sum + (point.x - meanX) ** 2, 0);
    const slope = denominator ? fitPoints.reduce((sum, point) => sum + (point.x - meanX) * (point.y - meanY), 0) / denominator : 0;
    const residual = Math.sqrt(fitPoints.reduce((sum, point) => sum + (point.y - (meanY + slope * (point.x - meanX))) ** 2, 0) / Math.max(1, fitPoints.length));
    const centerX = (minX + maxX) / 2;
    const baselineY = meanY + slope * (centerX - meanX);
    lines.push({
      index: lines.length,
      x: minX,
      y: top,
      width: lineWidth,
      height: bottom - top + 1,
      inkPixels,
      baselineCandidate: {
        y: baselineY,
        slopeDegrees: Math.atan(slope) * 180 / Math.PI,
        residualStdDev: residual,
        source: "lower-ink-envelope",
        confidence: "low",
      },
    });
  }
  return lines;
}

export function analyzePixels(rgba, width, height, corners, options = {}) {
  if (rgba.length !== width * height * 4) throw new Error("Image pixel dimensions do not match the buffer.");
  if (!isValidQuadrilateral(corners, width, height)) throw new Error("Choose four ordered crop corners inside the image.");
  const size = outputSize(corners, options.targetSizeMm);
  const rectified = warpRgba(rgba, width, height, corners, size.width, size.height);
  const initial = grayscale(rectified);
  const initialThreshold = otsuThreshold(initial.histogram);
  const initialMask = initialThreshold === null ? new Uint8Array(initial.gray.length) : makeMask(initial.gray, initialThreshold);
  const deskew = options.skipDeskew ? { degrees: 0, confidence: "medium" } : estimateDeskew(initialMask, size.width, size.height);
  const preview = rotateRgba(rectified, size.width, size.height, -deskew.degrees);
  const { gray, histogram } = grayscale(preview);
  const threshold = otsuThreshold(histogram);
  const mask = threshold === null ? new Uint8Array(gray.length) : makeMask(gray, threshold);
  const lines = detectLines(mask, size.width, size.height);
  const lineSpacing = lines.slice(1).map((line, index) => {
    const previous = lines[index];
    return line.y + line.height / 2 - (previous.y + previous.height / 2);
  });
  const foregroundPixels = mask.reduce((sum, value) => sum + value, 0);
  return {
    width: size.width,
    height: size.height,
    preview,
    mask,
    threshold,
    deskewDegrees: deskew.degrees,
    deskewConfidence: deskew.confidence,
    foregroundPixels,
    lines,
    lineSpacing,
  };
}

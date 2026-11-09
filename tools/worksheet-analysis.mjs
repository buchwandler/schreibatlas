const markerFormat = "schreibatlas-fiducial";
const maxMarkerScanPixels = 2_000_000;
const shapeGridSize = 20;

function isFinitePoint(point) {
  return Number.isFinite(point?.x) && Number.isFinite(point?.y);
}

function solveLinearSystem(matrix, values) {
  const size = values.length;
  const rows = matrix.map((row, index) => [...row, values[index]]);
  for (let column = 0; column < size; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < size; row += 1) {
      if (Math.abs(rows[row][column]) > Math.abs(rows[pivot][column])) pivot = row;
    }
    if (Math.abs(rows[pivot][column]) < 1e-10) return null;
    [rows[column], rows[pivot]] = [rows[pivot], rows[column]];
    const divisor = rows[column][column];
    for (let index = column; index <= size; index += 1) rows[column][index] /= divisor;
    for (let row = 0; row < size; row += 1) {
      if (row === column) continue;
      const factor = rows[row][column];
      for (let index = column; index <= size; index += 1) rows[row][index] -= factor * rows[column][index];
    }
  }
  return rows.map((row) => row[size]);
}

export function homographyFromPoints(source, target) {
  if (source.length !== 4 || target.length !== 4 || [...source, ...target].some((point) => !isFinitePoint(point))) return null;
  const matrix = [];
  const values = [];
  for (let index = 0; index < 4; index += 1) {
    const { x, y } = source[index];
    const { x: u, y: v } = target[index];
    matrix.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    values.push(u);
    matrix.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    values.push(v);
  }
  const coefficients = solveLinearSystem(matrix, values);
  return coefficients ? [...coefficients, 1] : null;
}

export function applyHomography(transform, point) {
  const [a, b, c, d, e, f, g, h, i] = transform;
  const denominator = g * point.x + h * point.y + i;
  if (!Number.isFinite(denominator) || Math.abs(denominator) < 1e-10) return null;
  const result = {
    x: (a * point.x + b * point.y + c) / denominator,
    y: (d * point.x + e * point.y + f) / denominator,
  };
  return isFinitePoint(result) ? result : null;
}

function otsuThreshold(histogram, total) {
  let sum = 0;
  for (let value = 0; value < histogram.length; value += 1) sum += value * histogram[value];
  let backgroundWeight = 0;
  let backgroundSum = 0;
  let bestVariance = -1;
  let threshold = 128;
  for (let value = 0; value < histogram.length; value += 1) {
    backgroundWeight += histogram[value];
    if (!backgroundWeight) continue;
    const foregroundWeight = total - backgroundWeight;
    if (!foregroundWeight) break;
    backgroundSum += value * histogram[value];
    const meansDifference = backgroundSum / backgroundWeight - (sum - backgroundSum) / foregroundWeight;
    const variance = backgroundWeight * foregroundWeight * meansDifference * meansDifference;
    if (variance > bestVariance) {
      bestVariance = variance;
      threshold = value;
    }
  }
  return Math.max(60, Math.min(220, threshold < 24 ? 128 : threshold));
}

function cellDarkFraction(binary, width, height, left, top, right, bottom) {
  const x0 = Math.max(0, Math.floor(left));
  const y0 = Math.max(0, Math.floor(top));
  const x1 = Math.min(width, Math.ceil(right));
  const y1 = Math.min(height, Math.ceil(bottom));
  let dark = 0;
  let count = 0;
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      dark += binary[y * width + x];
      count += 1;
    }
  }
  return count ? dark / count : 0;
}

function decodeMarkerCode(binary, width, height, minX, minY, boxWidth, boxHeight) {
  const fractions = [];
  const halfSample = Math.max(1, Math.min(boxWidth, boxHeight) * 0.045);
  for (const yRatio of [0.35, 0.65]) {
    for (const xRatio of [0.35, 0.65]) {
      const centerX = minX + boxWidth * xRatio;
      const centerY = minY + boxHeight * yRatio;
      fractions.push(cellDarkFraction(binary, width, height, centerX - halfSample, centerY - halfSample, centerX + halfSample, centerY + halfSample));
    }
  }
  const bits = fractions.map((fraction) => fraction >= 0.48);
  const code = bits.filter(Boolean).length;
  const confidence = fractions.reduce((sum, fraction, index) => sum + (bits[index] ? fraction : 1 - fraction), 0) / fractions.length;
  return { code, confidence };
}

function collectMarkerCandidates(rgba, width, height) {
  if (width < 2 || height < 2 || rgba.length !== width * height * 4) return [];
  const step = Math.max(1, Math.ceil(Math.sqrt((width * height) / maxMarkerScanPixels)));
  const scanWidth = Math.ceil(width / step);
  const scanHeight = Math.ceil(height / step);
  const pixelCount = scanWidth * scanHeight;
  const gray = new Uint8Array(pixelCount);
  const histogram = new Uint32Array(256);
  for (let y = 0; y < scanHeight; y += 1) {
    const sourceY = Math.min(height - 1, y * step);
    for (let x = 0; x < scanWidth; x += 1) {
      const sourceX = Math.min(width - 1, x * step);
      const sourceIndex = (sourceY * width + sourceX) * 4;
      const luminance = Math.round((rgba[sourceIndex] * 0.299) + (rgba[sourceIndex + 1] * 0.587) + (rgba[sourceIndex + 2] * 0.114));
      const index = y * scanWidth + x;
      gray[index] = luminance;
      histogram[luminance] += 1;
    }
  }
  const threshold = otsuThreshold(histogram, pixelCount);
  const binary = new Uint8Array(pixelCount);
  const visited = new Uint8Array(pixelCount);
  const queue = new Int32Array(pixelCount);
  for (let index = 0; index < pixelCount; index += 1) binary[index] = gray[index] < threshold ? 1 : 0;
  const smallestSide = Math.max(6, Math.min(scanWidth, scanHeight) * 0.004);
  const largestSide = Math.min(scanWidth, scanHeight) * 0.16;
  const candidates = [];

  for (let start = 0; start < pixelCount; start += 1) {
    if (!binary[start] || visited[start]) continue;
    let head = 0;
    let tail = 0;
    let minX = scanWidth;
    let minY = scanHeight;
    let maxX = -1;
    let maxY = -1;
    queue[tail++] = start;
    visited[start] = 1;
    while (head < tail) {
      const index = queue[head++];
      const x = index % scanWidth;
      const y = Math.floor(index / scanWidth);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (!dx && !dy) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= scanWidth || ny >= scanHeight) continue;
          const next = ny * scanWidth + nx;
          if (!binary[next] || visited[next]) continue;
          visited[next] = 1;
          queue[tail++] = next;
        }
      }
    }
    const boxWidth = maxX - minX + 1;
    const boxHeight = maxY - minY + 1;
    const side = Math.max(boxWidth, boxHeight);
    const aspect = boxWidth / boxHeight;
    const fill = tail / (boxWidth * boxHeight);
    if (side < smallestSide || side > largestSide || aspect < 0.62 || aspect > 1.62 || fill < 0.22) continue;
    const decoded = decodeMarkerCode(binary, scanWidth, scanHeight, minX, minY, boxWidth, boxHeight);
    if (decoded.code < 1 || decoded.code > 4 || decoded.confidence < 0.58) continue;
    const aspectScore = Math.max(0, 1 - Math.abs(Math.log(aspect)) * 0.45);
    const expectedFill = decoded.code === 4 ? 0.92 : 0.52;
    const fillScore = Math.max(0, 1 - Math.abs(fill - expectedFill) * 0.55);
    candidates.push({
      code: decoded.code,
      x: ((minX + maxX + 1) / 2) * step,
      y: ((minY + maxY + 1) / 2) * step,
      side: side * step,
      confidence: decoded.confidence * aspectScore * fillScore,
    });
  }
  return candidates;
}

function validPageCorners(corners, width, height) {
  if (corners.some((point) => !point || point.x < 0 || point.y < 0 || point.x > width - 1 || point.y > height - 1)) return false;
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
  return area >= width * height * 0.04;
}

function pageGeometry(candidates, positions, pageWidth, pageHeight, imageWidth, imageHeight) {
  const byCode = new Map();
  for (let code = 1; code <= 4; code += 1) {
    const choices = candidates.filter((candidate) => candidate.code === code).sort((a, b) => b.side - a.side).slice(0, 8);
    if (!choices.length) return [];
    byCode.set(code, choices);
  }
  const targetByCode = new Map(positions.map((position) => [position.code, { x: position.x, y: position.y }]));
  const output = [];
  const selections = [];
  const choose = (code) => {
    if (code > 4) {
      const sides = selections.map((marker) => marker.side);
      const sizeSpread = Math.max(...sides) / Math.min(...sides);
      if (sizeSpread > 2.1) return;
      const source = selections.map(({ x, y }) => ({ x, y }));
      const target = [1, 2, 3, 4].map((id) => targetByCode.get(id));
      const transform = homographyFromPoints(target, source);
      if (!transform) return;
      const corners = [
        { x: 0, y: 0 },
        { x: pageWidth, y: 0 },
        { x: pageWidth, y: pageHeight },
        { x: 0, y: pageHeight },
      ].map((point) => applyHomography(transform, point));
      if (!validPageCorners(corners, imageWidth, imageHeight)) return;
      const markerScore = selections.reduce((sum, marker) => sum + marker.confidence, 0) / selections.length;
      const averagePageWidth = (Math.hypot(corners[1].x - corners[0].x, corners[1].y - corners[0].y) + Math.hypot(corners[2].x - corners[3].x, corners[2].y - corners[3].y)) / 2;
      const averagePageHeight = (Math.hypot(corners[3].x - corners[0].x, corners[3].y - corners[0].y) + Math.hypot(corners[2].x - corners[1].x, corners[2].y - corners[1].y)) / 2;
      const measuredAspect = averagePageWidth / averagePageHeight;
      const expectedAspect = pageWidth / pageHeight;
      if (measuredAspect < expectedAspect * 0.4 || measuredAspect > expectedAspect * 2.5) return;
      const confidence = Math.max(0, markerScore - Math.max(0, sizeSpread - 1) * 0.18);
      output.push({ corners, markers: selections.map((marker, index) => ({ code: index + 1, x: marker.x, y: marker.y, confidence: marker.confidence })), confidence, sizeSpread });
      return;
    }
    for (const candidate of byCode.get(code)) {
      selections.push(candidate);
      choose(code + 1);
      selections.pop();
    }
  };
  choose(1);
  return output.sort((a, b) => b.confidence - a.confidence);
}

export function detectWorksheetGeometry(rgba, width, height, metadata) {
  const marker = metadata?.worksheetMarker;
  const pageWidth = marker?.pageWidthMm;
  const pageHeight = marker?.pageHeightMm;
  const positions = marker?.positionsMm;
  if (marker?.format !== markerFormat || marker.version !== 1 || !Number.isFinite(pageWidth) || !Number.isFinite(pageHeight) || !Array.isArray(positions) || positions.length !== 4) {
    return { status: "unavailable", confidence: 0, reason: "worksheet-marker-metadata-missing", worksheetId: metadata?.worksheetId ?? null };
  }
  const candidates = collectMarkerCandidates(rgba, width, height);
  const geometries = pageGeometry(candidates, positions, pageWidth, pageHeight, width, height);
  const best = geometries[0];
  if (!best) return { status: "unavailable", confidence: 0, reason: "four-worksheet-markers-not-confidently-recognized", worksheetId: metadata.worksheetId ?? null, candidateCount: candidates.length };
  const recognized = best.confidence >= 0.72;
  return {
    status: recognized ? "recognized" : "low-confidence",
    confidence: best.confidence,
    reason: recognized ? null : "worksheet-marker-confidence-below-threshold",
    worksheetId: metadata.worksheetId ?? null,
    pageCorners: recognized ? best.corners : null,
    markers: best.markers,
    candidateCount: candidates.length,
    pageSizeMm: { width: pageWidth, height: pageHeight },
  };
}

export function worksheetWritingRegions(metadata, width, height) {
  const pageWidth = metadata?.worksheetMarker?.pageWidthMm;
  const pageHeight = metadata?.worksheetMarker?.pageHeightMm;
  const area = metadata?.writingRegionMm;
  if (!Number.isFinite(pageWidth) || !Number.isFinite(pageHeight) || !Number.isFinite(area?.left) || !Number.isFinite(area?.right) || !Array.isArray(area?.blankRows)) return [];
  const scaleX = width / pageWidth;
  const scaleY = height / pageHeight;
  return area.blankRows.map((row) => ({
    id: String(row.id),
    left: area.left * scaleX,
    right: area.right * scaleX,
    top: row.top * scaleY,
    baseline: row.baseline * scaleY,
    xHeight: row.xHeight * scaleY,
    bottom: (row.top + row.height) * scaleY,
    scaleX,
    scaleY,
  })).filter((row) => row.left >= 0 && row.right <= width && row.top >= 0 && row.bottom <= height && row.right > row.left && row.bottom > row.top);
}

function zhangSuenSkeleton(mask, width, height) {
  const output = mask.slice();
  const removed = [];
  let changed = true;
  let iteration = 0;
  while (changed && iteration < 48) {
    changed = false;
    iteration += 1;
    for (let pass = 0; pass < 2; pass += 1) {
      removed.length = 0;
      for (let y = 1; y < height - 1; y += 1) {
        for (let x = 1; x < width - 1; x += 1) {
          const index = y * width + x;
          if (!output[index]) continue;
          const neighbors = [output[index - width], output[index - width + 1], output[index + 1], output[index + width + 1], output[index + width], output[index + width - 1], output[index - 1], output[index - width - 1]];
          const count = neighbors.reduce((sum, value) => sum + value, 0);
          if (count < 2 || count > 6) continue;
          let transitions = 0;
          for (let neighbor = 0; neighbor < 8; neighbor += 1) if (!neighbors[neighbor] && neighbors[(neighbor + 1) % 8]) transitions += 1;
          if (transitions !== 1) continue;
          const [north, , east, , south, , west] = neighbors;
          if (pass === 0 ? north * east * south || east * south * west : north * east * west || north * south * west) continue;
          removed.push(index);
        }
      }
      if (removed.length) {
        changed = true;
        for (const index of removed) output[index] = 0;
      }
    }
  }
  let skeletonPixels = 0;
  let endpoints = 0;
  let branches = 0;
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x;
      if (!output[index]) continue;
      skeletonPixels += 1;
      let neighbors = 0;
      for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) if ((dx || dy) && output[(y + dy) * width + x + dx]) neighbors += 1;
      if (neighbors === 1) endpoints += 1;
      if (neighbors >= 3) branches += 1;
    }
  }
  return { skeletonPixels, endpoints, branches, iterations: iteration };
}

function describeComponent(mask, width, height, bounds) {
  const boxWidth = bounds.maxX - bounds.minX + 1;
  const boxHeight = bounds.maxY - bounds.minY + 1;
  if (boxWidth < 2 || boxHeight < 2 || boxWidth * boxHeight > 90_000) return null;
  const local = new Uint8Array(boxWidth * boxHeight);
  let area = 0;
  let perimeter = 0;
  for (let y = 0; y < boxHeight; y += 1) {
    for (let x = 0; x < boxWidth; x += 1) {
      const sourceX = bounds.minX + x;
      const sourceY = bounds.minY + y;
      const value = mask[sourceY * width + sourceX];
      if (!value) continue;
      local[y * boxWidth + x] = 1;
      area += 1;
      if (!x || !local[y * boxWidth + x - 1]) perimeter += 1;
      if (!y || !mask[(sourceY - 1) * width + sourceX]) perimeter += 1;
      if (x === boxWidth - 1 || !mask[sourceY * width + sourceX + 1]) perimeter += 1;
      if (y === boxHeight - 1 || !mask[(sourceY + 1) * width + sourceX]) perimeter += 1;
    }
  }
  const skeleton = zhangSuenSkeleton(local, boxWidth, boxHeight);
  const normalizedMask = new Uint8Array(shapeGridSize * shapeGridSize);
  for (let gy = 0; gy < shapeGridSize; gy += 1) {
    const y0 = Math.floor((gy / shapeGridSize) * boxHeight);
    const y1 = Math.max(y0 + 1, Math.ceil(((gy + 1) / shapeGridSize) * boxHeight));
    for (let gx = 0; gx < shapeGridSize; gx += 1) {
      const x0 = Math.floor((gx / shapeGridSize) * boxWidth);
      const x1 = Math.max(x0 + 1, Math.ceil(((gx + 1) / shapeGridSize) * boxWidth));
      let occupied = false;
      for (let y = y0; y < Math.min(boxHeight, y1) && !occupied; y += 1) {
        for (let x = x0; x < Math.min(boxWidth, x1); x += 1) if (local[y * boxWidth + x]) { occupied = true; break; }
      }
      normalizedMask[gy * shapeGridSize + gx] = occupied ? 1 : 0;
    }
  }
  const contour = [];
  for (let y = 0; y < boxHeight; y += 1) {
    for (let x = 0; x < boxWidth; x += 1) {
      if (!local[y * boxWidth + x]) continue;
      if (x && y && x < boxWidth - 1 && y < boxHeight - 1 && local[y * boxWidth + x - 1] && local[y * boxWidth + x + 1] && local[(y - 1) * boxWidth + x] && local[(y + 1) * boxWidth + x]) continue;
      contour.push({ x, y });
    }
  }
  const contourCenter = contour.reduce((result, point) => ({ x: result.x + point.x / contour.length, y: result.y + point.y / contour.length }), { x: 0, y: 0 });
  contour.sort((first, second) => Math.atan2(first.y - contourCenter.y, first.x - contourCenter.x) - Math.atan2(second.y - contourCenter.y, second.x - contourCenter.x));
  const contourPoints = Array.from({ length: 32 }, (_, index) => {
    const point = contour[Math.floor(index * contour.length / 32)];
    return { x: point.x / Math.max(1, boxWidth - 1), y: point.y / Math.max(1, boxHeight - 1) };
  });
  return {
    x: bounds.minX,
    y: bounds.minY,
    width: boxWidth,
    height: boxHeight,
    area,
    aspectRatio: boxWidth / boxHeight,
    fillRatio: area / (boxWidth * boxHeight),
    perimeter,
    compactness: perimeter ? (4 * Math.PI * area) / (perimeter * perimeter) : 0,
    ...skeleton,
    normalizedMask,
    contourPoints,
  };
}

function componentsInRegion(mask, width, height, region, guides) {
  const left = Math.max(0, Math.floor(region.left));
  const right = Math.min(width, Math.ceil(region.right));
  const top = Math.max(0, Math.floor(region.top));
  const bottom = Math.min(height, Math.ceil(region.bottom));
  const regionWidth = right - left;
  const regionHeight = bottom - top;
  if (regionWidth < 2 || regionHeight < 2 || regionWidth * regionHeight > 1_000_000) return { status: "unavailable", reason: "writing-region-size-out-of-bounds", components: [], inkPixels: 0 };
  const localMask = new Uint8Array(regionWidth * regionHeight);
  const baselineBand = Math.max(1, Math.round(region.scaleY * 0.16));
  const xHeightBand = Math.max(1, Math.round(region.scaleY * 0.14));
  let inkPixels = 0;
  for (let y = 0; y < regionHeight; y += 1) {
    const globalY = top + y;
    if (Math.abs(globalY - region.baseline) <= baselineBand || (guides === "baseline-xheight" && Math.abs(globalY - region.xHeight) <= xHeightBand)) continue;
    for (let x = 0; x < regionWidth; x += 1) {
      if (!mask[globalY * width + left + x]) continue;
      localMask[y * regionWidth + x] = 1;
      inkPixels += 1;
    }
  }
  const visited = new Uint8Array(localMask.length);
  const queue = new Int32Array(localMask.length);
  const components = [];
  let noisePixels = 0;
  for (let start = 0; start < localMask.length; start += 1) {
    if (!localMask[start] || visited[start]) continue;
    let head = 0;
    let tail = 0;
    let minX = regionWidth;
    let minY = regionHeight;
    let maxX = -1;
    let maxY = -1;
    queue[tail++] = start;
    visited[start] = 1;
    while (head < tail) {
      const index = queue[head++];
      const x = index % regionWidth;
      const y = Math.floor(index / regionWidth);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (!dx && !dy) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= regionWidth || ny >= regionHeight) continue;
          const next = ny * regionWidth + nx;
          if (!localMask[next] || visited[next]) continue;
          visited[next] = 1;
          queue[tail++] = next;
        }
      }
    }
    if (tail < 4) {
      noisePixels += tail;
      continue;
    }
    if (components.length >= 128) return { status: "unavailable", reason: "too-many-ink-components-for-confident-segmentation", components: [], inkPixels };
    const component = describeComponent(localMask, regionWidth, regionHeight, { minX, minY, maxX, maxY });
    if (component) {
      component.x += left;
      component.y += top;
      components.push(component);
    }
  }
  const publicComponents = components.map(({ normalizedMask, contourPoints, ...component }) => component);
  return { status: "measured", reason: null, components, publicComponents, inkPixels, noisePixels, regionBounds: { left, right, top, bottom } };
}

export function clusterRepeatedShapes(shapes, threshold = 0.16) {
  if (shapes.length < 2) return { status: "unavailable", reason: "at-least-two-isolated-shapes-required", clusters: [] };
  const clusters = [];
  for (let index = 0; index < shapes.length; index += 1) {
    const shape = shapes[index];
    let best = null;
    let bestDistance = Infinity;
    for (const cluster of clusters) {
      const distance = cluster.members.reduce((sum, member) => sum + shapeDistance(shape, member), 0) / cluster.members.length;
      if (distance < bestDistance) { best = cluster; bestDistance = distance; }
    }
    if (best && bestDistance <= threshold) best.members.push(shape);
    else clusters.push({ members: [shape] });
  }
  const distances = [];
  for (let first = 0; first < shapes.length; first += 1) for (let second = first + 1; second < shapes.length; second += 1) distances.push(shapeDistance(shapes[first], shapes[second]));
  const meanDistance = distances.reduce((sum, value) => sum + value, 0) / distances.length;
  return { status: "available", clusters: clusters.map((cluster) => ({ count: cluster.members.length })), meanShapeDistance: meanDistance, threshold };
}

function shapeDistance(first, second) {
  if (!first.normalizedMask || !second.normalizedMask || first.normalizedMask.length !== second.normalizedMask.length) return 1;
  let different = 0;
  for (let index = 0; index < first.normalizedMask.length; index += 1) if (first.normalizedMask[index] !== second.normalizedMask[index]) different += 1;
  return different / first.normalizedMask.length;
}

export function fitConstrainedSimilarity(referencePoints, samplePoints, limits = {}) {
  const minScale = limits.minScale ?? 0.8;
  const maxScale = limits.maxScale ?? 1.25;
  const maxRotationDegrees = limits.maxRotationDegrees ?? 12;
  const maxTranslation = limits.maxTranslation ?? 0.15;
  const maxResidual = limits.maxResidual ?? 0.08;
  if (referencePoints.length !== samplePoints.length || referencePoints.length < 2 || [...referencePoints, ...samplePoints].some((point) => !isFinitePoint(point))) {
    return { status: "unavailable", reason: "matching-point-correspondence-required" };
  }
  const center = (points) => points.reduce((result, point) => ({ x: result.x + point.x / points.length, y: result.y + point.y / points.length }), { x: 0, y: 0 });
  const referenceCenter = center(referencePoints);
  const sampleCenter = center(samplePoints);
  let dot = 0;
  let cross = 0;
  let denominator = 0;
  for (let index = 0; index < referencePoints.length; index += 1) {
    const rx = referencePoints[index].x - referenceCenter.x;
    const ry = referencePoints[index].y - referenceCenter.y;
    const sx = samplePoints[index].x - sampleCenter.x;
    const sy = samplePoints[index].y - sampleCenter.y;
    dot += rx * sx + ry * sy;
    cross += rx * sy - ry * sx;
    denominator += rx * rx + ry * ry;
  }
  if (denominator < 1e-9) return { status: "unavailable", reason: "degenerate-reference-points" };
  const scale = Math.hypot(dot, cross) / denominator;
  const rotationRadians = Math.atan2(cross, dot);
  const rotationDegrees = rotationRadians * 180 / Math.PI;
  const translation = {
    x: sampleCenter.x - scale * (Math.cos(rotationRadians) * referenceCenter.x - Math.sin(rotationRadians) * referenceCenter.y),
    y: sampleCenter.y - scale * (Math.sin(rotationRadians) * referenceCenter.x + Math.cos(rotationRadians) * referenceCenter.y),
  };
  const residual = Math.sqrt(referencePoints.reduce((sum, point, index) => {
    const fitted = {
      x: scale * (Math.cos(rotationRadians) * point.x - Math.sin(rotationRadians) * point.y) + translation.x,
      y: scale * (Math.sin(rotationRadians) * point.x + Math.cos(rotationRadians) * point.y) + translation.y,
    };
    return sum + (fitted.x - samplePoints[index].x) ** 2 + (fitted.y - samplePoints[index].y) ** 2;
  }, 0) / referencePoints.length);
  if (scale < minScale || scale > maxScale || Math.abs(rotationDegrees) > maxRotationDegrees || Math.hypot(translation.x, translation.y) > maxTranslation || residual > maxResidual) {
    return { status: "unavailable", reason: "constrained-similarity-fit-out-of-bounds", scale, rotationDegrees, translation, residual };
  }
  return { status: "available", scale, rotationDegrees, translation, residual, confidence: Math.max(0, 1 - residual / maxResidual) };
}

function graphemes(text) {
  return [...new Intl.Segmenter("und", { granularity: "grapheme" }).segment(text)].map((entry) => entry.segment).filter((entry) => !/^\s+$/u.test(entry));
}

export function analyzeWorksheetWriting(mask, width, height, metadata, geometryConfidence) {
  if (geometryConfidence < 0.8) return { status: "unavailable", reason: "worksheet-geometry-confidence-too-low", rows: [], repeatedLetterAnalysis: { status: "unavailable", reason: "worksheet-geometry-confidence-too-low" } };
  if (!(mask instanceof Uint8Array) || mask.length !== width * height) return { status: "unavailable", reason: "invalid-mask-dimensions", rows: [], repeatedLetterAnalysis: { status: "unavailable", reason: "invalid-mask-dimensions" } };
  const regions = worksheetWritingRegions(metadata, width, height);
  if (!regions.length) return { status: "unavailable", reason: "no-calibrated-blank-writing-rows", rows: [], repeatedLetterAnalysis: { status: "unavailable", reason: "no-calibrated-blank-writing-rows" } };
  const rows = regions.map((region) => {
    const extraction = componentsInRegion(mask, width, height, region, metadata.settings?.guides);
    if (extraction.status !== "measured") return { id: region.id, status: extraction.status, reason: extraction.reason };
    const components = extraction.components;
    const maxY = components.length ? Math.max(...components.map((component) => component.y + component.height)) : null;
    const baselineOffsetMm = maxY === null ? null : (region.baseline - maxY) / region.scaleY;
    return {
      id: region.id,
      status: "measured",
      inkPixels: extraction.inkPixels,
      componentCount: components.length,
      noisePixels: extraction.noisePixels,
      inkBoundsMm: components.length ? {
        left: (Math.min(...components.map((component) => component.x)) - region.left) / region.scaleX,
        right: (Math.max(...components.map((component) => component.x + component.width)) - region.left) / region.scaleX,
        top: (Math.min(...components.map((component) => component.y)) - region.top) / region.scaleY,
        bottom: (maxY - region.top) / region.scaleY,
      } : null,
      baselineOffsetMm,
      components: extraction.publicComponents,
      privateShapes: components,
    };
  });
  const expected = graphemes(metadata.settings?.text ?? "");
  const repeated = expected.length >= 2 && expected.every((character) => character === expected[0]);
  const eligibleRows = rows.filter((row) => row.status === "measured" && row.inkPixels > 0);
  let repeatedLetterAnalysis;
  if (!repeated) repeatedLetterAnalysis = { status: "unavailable", reason: "expected-text-is-not-one-repeated-character" };
  else {
    const candidates = eligibleRows.filter((row) => row.componentCount === expected.length && row.noisePixels === 0 && row.privateShapes.every((shape) => shape.area >= 8));
    if (!candidates.length) repeatedLetterAnalysis = { status: "unavailable", reason: "isolated-character-count-or-segmentation-confidence-insufficient" };
    else {
      const row = candidates[0];
      const fits = row.privateShapes.slice(1).map((shape) => fitConstrainedSimilarity(row.privateShapes[0].contourPoints, shape.contourPoints));
      if (fits.some((fit) => fit.status !== "available")) {
        repeatedLetterAnalysis = { status: "unavailable", reason: "constrained-contour-alignment-confidence-insufficient" };
      } else {
        const clusters = clusterRepeatedShapes(row.privateShapes);
        repeatedLetterAnalysis = {
          status: "available",
          character: expected[0],
          rowId: row.id,
          isolatedComponentCount: row.componentCount,
          clusters: clusters.clusters,
          meanShapeDistance: clusters.meanShapeDistance,
          constrainedFits: fits,
          note: "Components are compared locally by normalized binary shape and bounded similarity fits. This is not handwriting recognition or a quality score.",
        };
      }
    }
  }
  const alignedRowId = repeatedLetterAnalysis.status === "available" ? repeatedLetterAnalysis.rowId : null;
  for (const row of rows) {
    delete row.privateShapes;
    if (row.id !== alignedRowId) delete row.components;
  }
  const measuredOffsets = rows.filter((row) => row.status === "measured" && row.baselineOffsetMm !== null).map((row) => row.baselineOffsetMm);
  const baselineOffsetSpreadMm = measuredOffsets.length > 1
    ? Math.sqrt(measuredOffsets.reduce((sum, value) => sum + (value - measuredOffsets.reduce((total, item) => total + item, 0) / measuredOffsets.length) ** 2, 0) / measuredOffsets.length)
    : null;
  return {
    status: "measured",
    calibrationConfidence: geometryConfidence,
    rows,
    multiLineDiagnostics: { measuredRows: measuredOffsets.length, baselineOffsetSpreadMm },
    repeatedLetterAnalysis,
    qualityRating: null,
  };
}

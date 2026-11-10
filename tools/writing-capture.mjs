// SPDX-License-Identifier: Apache-2.0
export function splitCaptureStrokes(samples) {
  const strokes = [];
  let current = [];
  for (const sample of samples) {
    if (sample.penDown) {
      current.push(sample);
    } else if (current.length) {
      strokes.push(current);
      current = [];
    }
  }
  if (current.length) strokes.push(current);
  return strokes;
}

export function measureCapture(samples) {
  const strokes = splitCaptureStrokes(samples);
  const drawingSamples = strokes.flat();
  let pathLength = 0;
  for (const stroke of strokes) {
    for (let index = 1; index < stroke.length; index += 1) {
      const previous = stroke[index - 1];
      const current = stroke[index];
      pathLength += Math.hypot(current.x - previous.x, current.y - previous.y);
    }
  }

  let bounds = null;
  for (const sample of drawingSamples) {
    if (!bounds) bounds = { minX: sample.x, minY: sample.y, maxX: sample.x, maxY: sample.y };
    else {
      bounds.minX = Math.min(bounds.minX, sample.x);
      bounds.minY = Math.min(bounds.minY, sample.y);
      bounds.maxX = Math.max(bounds.maxX, sample.x);
      bounds.maxY = Math.max(bounds.maxY, sample.y);
    }
  }

  return {
    strokeCount: strokes.length,
    sampleCount: samples.length,
    pressureSampleCount: drawingSamples.filter(({ pressure }) => Number.isFinite(pressure)).length,
    pathLength,
    width: bounds ? bounds.maxX - bounds.minX : 0,
    height: bounds ? bounds.maxY - bounds.minY : 0,
    durationMs: samples.length > 1 ? Math.max(0, samples.at(-1).t - samples[0].t) : 0,
    bounds,
  };
}

// SPDX-License-Identifier: Apache-2.0
const observationNames = ["start", "direction", "order", "penLifts", "rhythm"];
const matchThreshold = 0.08;
const differentThreshold = 0.3;

function unavailableObservation(reason) {
  return { status: "unavailable", confidence: null, error: null, reason };
}

function unavailableResult(reason) {
  return {
    available: false,
    reason,
    alignment: null,
    observations: Object.fromEntries(observationNames.map((name) => [name, unavailableObservation(reason)])),
  };
}

function boundsOf(points) {
  if (!points.length) return null;
  return points.reduce((bounds, point) => ({
    minX: Math.min(bounds.minX, point.x),
    minY: Math.min(bounds.minY, point.y),
    maxX: Math.max(bounds.maxX, point.x),
    maxY: Math.max(bounds.maxY, point.y),
  }), { minX: points[0].x, minY: points[0].y, maxX: points[0].x, maxY: points[0].y });
}

function validPolyline(points) {
  return Array.isArray(points) && points.length >= 2 && points.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
}

function resample(points, count = 32) {
  if (!validPolyline(points)) return null;
  const cumulative = [0];
  for (let index = 1; index < points.length; index += 1) {
    cumulative.push(cumulative[index - 1] + Math.hypot(points[index].x - points[index - 1].x, points[index].y - points[index - 1].y));
  }
  const total = cumulative.at(-1);
  if (!Number.isFinite(total) || total <= 1e-9) return null;

  return Array.from({ length: count }, (_value, sampleIndex) => {
    const target = (total * sampleIndex) / (count - 1);
    let segment = 1;
    while (segment < cumulative.length - 1 && cumulative[segment] < target) segment += 1;
    const segmentLength = cumulative[segment] - cumulative[segment - 1];
    const ratio = segmentLength > 0 ? (target - cumulative[segment - 1]) / segmentLength : 0;
    const start = points[segment - 1];
    const end = points[segment];
    return { x: start.x + (end.x - start.x) * ratio, y: start.y + (end.y - start.y) * ratio };
  });
}

function meanDistance(expected, observed, reverse = false) {
  return expected.reduce((sum, point, index) => {
    const other = observed[reverse ? observed.length - index - 1 : index];
    return sum + Math.hypot(point.x - other.x, point.y - other.y);
  }, 0) / expected.length;
}

function classifyError(error) {
  if (error <= matchThreshold) return { status: "match", confidence: Math.max(0.7, 1 - (error / matchThreshold) * 0.3), error };
  if (error >= differentThreshold) return { status: "different", confidence: Math.min(1, 0.7 + (error - differentThreshold) * 0.5), error };
  return { status: "uncertain", confidence: null, error };
}

function boundedAlignment(referenceStrokes, capturedStrokes) {
  const referenceBounds = boundsOf(referenceStrokes.flat());
  const capturedBounds = boundsOf(capturedStrokes.flat());
  if (!referenceBounds || !capturedBounds) return null;
  const referenceExtent = Math.max(referenceBounds.maxX - referenceBounds.minX, referenceBounds.maxY - referenceBounds.minY);
  const capturedExtent = Math.max(capturedBounds.maxX - capturedBounds.minX, capturedBounds.maxY - capturedBounds.minY);
  if (referenceExtent <= 1e-9 || capturedExtent <= 1e-9) return null;

  const scale = referenceExtent / capturedExtent;
  if (scale < 0.5 || scale > 2) return { bounded: false, scale };
  const referenceCenter = { x: (referenceBounds.minX + referenceBounds.maxX) / 2, y: (referenceBounds.minY + referenceBounds.maxY) / 2 };
  const capturedCenter = { x: (capturedBounds.minX + capturedBounds.maxX) / 2, y: (capturedBounds.minY + capturedBounds.maxY) / 2 };
  const translation = {
    x: referenceCenter.x - scale * capturedCenter.x,
    y: referenceCenter.y - scale * capturedCenter.y,
  };
  return {
    bounded: true,
    scale,
    translation,
    transform: (point) => ({ x: scale * point.x + translation.x, y: scale * point.y + translation.y }),
  };
}

function rhythmObservation(referenceStrokes, capturedStrokes) {
  if (referenceStrokes.length < 2 || referenceStrokes.length !== capturedStrokes.length) return unavailableObservation("timing-unavailable");
  const referenceDurations = referenceStrokes.map((stroke) => stroke.timingMs);
  const capturedDurations = capturedStrokes.map((stroke) => {
    const times = stroke.map((point) => point.t).filter(Number.isFinite);
    return times.length >= 2 ? Math.max(...times) - Math.min(...times) : null;
  });
  if (referenceDurations.some((duration) => !Number.isFinite(duration) || duration <= 0)
    || capturedDurations.some((duration) => !Number.isFinite(duration) || duration <= 0)) {
    return unavailableObservation("timing-unavailable");
  }
  const referenceTotal = referenceDurations.reduce((sum, duration) => sum + duration, 0);
  const capturedTotal = capturedDurations.reduce((sum, duration) => sum + duration, 0);
  const error = referenceDurations.reduce((sum, duration, index) => sum + Math.abs(duration / referenceTotal - capturedDurations[index] / capturedTotal), 0) / referenceDurations.length;
  return classifyError(error);
}

export function compareVerifiedStrokes(reference, capturedStrokes) {
  if (!reference || reference.verification !== "verified" || !Array.isArray(reference.sources) || reference.sources.length === 0) {
    return unavailableResult("no-verified-source-backed-strokes");
  }
  if (!Array.isArray(reference.strokes) || reference.strokes.length === 0) return unavailableResult("empty-reference-strokes");
  if (!Array.isArray(capturedStrokes) || capturedStrokes.length === 0) return unavailableResult("no-captured-strokes");

  const referenceDown = reference.strokes.filter((stroke) => stroke.penDown);
  if (!referenceDown.length || referenceDown.some((stroke) => !validPolyline(stroke.points))) {
    return unavailableResult("reference-geometry-unavailable");
  }
  if (capturedStrokes.some((stroke) => !validPolyline(stroke))) return unavailableResult("capture-geometry-insufficient");

  const referencePoints = referenceDown.map((stroke) => resample(stroke.points));
  const capturedPoints = capturedStrokes.map((stroke) => resample(stroke));
  if (referencePoints.some((stroke) => !stroke) || capturedPoints.some((stroke) => !stroke)) {
    return unavailableResult("degenerate-stroke-geometry");
  }

  const alignment = boundedAlignment(referencePoints, capturedPoints);
  const observations = Object.fromEntries(observationNames.map((name) => [name, unavailableObservation("bounded-fit-unavailable")]));
  const expectedLifts = Math.max(0, referenceDown.length - 1);
  const capturedLifts = Math.max(0, capturedStrokes.length - 1);
  observations.penLifts = {
    status: referenceDown.length === capturedStrokes.length ? "match" : "different",
    confidence: 1,
    error: Math.abs(expectedLifts - capturedLifts),
    expected: expectedLifts,
    observed: capturedLifts,
  };
  observations.rhythm = rhythmObservation(referenceDown, capturedStrokes);

  if (!alignment?.bounded) {
    return {
      available: true,
      reason: "bounded-fit-outside-range",
      alignment: alignment ? { kind: "uniform-scale-translation", scale: alignment.scale, rotationDegrees: 0, shear: 0 } : null,
      observations,
    };
  }

  const alignedCaptured = capturedPoints.map((stroke) => stroke.map(alignment.transform));
  const pairedCount = Math.min(referencePoints.length, alignedCaptured.length);
  if (pairedCount > 0) {
    const startError = Math.hypot(referencePoints[0][0].x - alignedCaptured[0][0].x, referencePoints[0][0].y - alignedCaptured[0][0].y);
    observations.start = classifyError(startError);

    const paired = Array.from({ length: pairedCount }, (_value, index) => ({
      direct: meanDistance(referencePoints[index], alignedCaptured[index]),
      reverse: meanDistance(referencePoints[index], alignedCaptured[index], true),
    }));
    const directDirectionError = paired.reduce((sum, item) => sum + item.direct, 0) / paired.length;
    const reverseDirectionError = paired.reduce((sum, item) => sum + item.reverse, 0) / paired.length;
    if (pairedCount === referencePoints.length && pairedCount === alignedCaptured.length
      && directDirectionError <= matchThreshold && directDirectionError + 0.04 < reverseDirectionError) {
      observations.direction = classifyError(directDirectionError);
    } else if (pairedCount === referencePoints.length && pairedCount === alignedCaptured.length
      && reverseDirectionError <= matchThreshold && reverseDirectionError + 0.04 < directDirectionError) {
      observations.direction = { ...classifyError(reverseDirectionError), status: "different" };
    } else {
      observations.direction = { status: "uncertain", confidence: null, error: Math.min(directDirectionError, reverseDirectionError) };
    }

    const orderedError = paired.reduce((sum, item) => sum + Math.min(item.direct, item.reverse), 0) / paired.length;
    const reversedOrderError = referencePoints.length === alignedCaptured.length
      ? referencePoints.reduce((sum, stroke, index) => sum + Math.min(
        meanDistance(stroke, alignedCaptured[alignedCaptured.length - index - 1]),
        meanDistance(stroke, alignedCaptured[alignedCaptured.length - index - 1], true),
      ), 0) / referencePoints.length
      : Number.POSITIVE_INFINITY;
    if (pairedCount === referencePoints.length && pairedCount === alignedCaptured.length
      && orderedError <= matchThreshold && (referencePoints.length === 1 || orderedError + 0.04 < reversedOrderError)) {
      observations.order = classifyError(orderedError);
    } else if (pairedCount === referencePoints.length && pairedCount === alignedCaptured.length
      && reversedOrderError <= matchThreshold && reversedOrderError + 0.04 < orderedError) {
      observations.order = { ...classifyError(reversedOrderError), status: "different" };
    } else {
      observations.order = { status: "uncertain", confidence: null, error: Math.min(orderedError, reversedOrderError) };
    }
  }

  return {
    available: true,
    reason: null,
    alignment: {
      kind: "uniform-scale-translation",
      scale: alignment.scale,
      translation: alignment.translation,
      rotationDegrees: 0,
      shear: 0,
    },
    observations,
  };
}

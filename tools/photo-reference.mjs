// SPDX-License-Identifier: Apache-2.0
function unavailable(reason) {
  return {
    available: false,
    reason,
    confidence: "unavailable",
    transform: null,
    residual: null,
  };
}

function fitAxis(pairs) {
  const meanSource = pairs.reduce((sum, pair) => sum + pair.source, 0) / pairs.length;
  const meanTarget = pairs.reduce((sum, pair) => sum + pair.target, 0) / pairs.length;
  const denominator = pairs.reduce((sum, pair) => sum + (pair.source - meanSource) ** 2, 0);
  if (denominator <= 1e-9) return null;
  const scale = pairs.reduce((sum, pair) => sum + (pair.source - meanSource) * (pair.target - meanTarget), 0) / denominator;
  return { scale, offset: meanTarget - scale * meanSource };
}

function validReferenceLine(line) {
  return line && typeof line.text === "string"
    && [line.inkLeft, line.inkRight, line.ascent, line.descent, line.baseline].every(Number.isFinite)
    && line.inkRight > line.inkLeft
    && line.ascent + line.descent > 0;
}

function validObservedLine(line) {
  return line && [line.x, line.y, line.width, line.height].every(Number.isFinite)
    && line.width > 0 && line.height > 0;
}

export function fitReferenceText(referenceLines, observedLines) {
  if (!Array.isArray(referenceLines) || referenceLines.length === 0) return unavailable("empty-reference-text");
  if (!Array.isArray(observedLines) || observedLines.length === 0) return unavailable("no-detected-lines");
  if (referenceLines.length !== observedLines.length) return unavailable("line-count-mismatch");
  if (referenceLines.some((line) => !validReferenceLine(line)) || observedLines.some((line) => !validObservedLine(line))) {
    return unavailable("invalid-line-geometry");
  }

  const xPairs = [];
  const yPairs = [];
  for (let index = 0; index < referenceLines.length; index += 1) {
    const reference = referenceLines[index];
    const observed = observedLines[index];
    xPairs.push(
      { source: reference.inkLeft, target: observed.x },
      { source: reference.inkRight, target: observed.x + observed.width },
    );
    yPairs.push(
      { source: reference.baseline - reference.ascent, target: observed.y },
      { source: reference.baseline + reference.descent, target: observed.y + observed.height },
    );
  }

  const horizontal = fitAxis(xPairs);
  const vertical = fitAxis(yPairs);
  if (!horizontal || !vertical || horizontal.scale <= 0 || vertical.scale <= 0) return unavailable("degenerate-fit");
  if (horizontal.scale < 0.2 || horizontal.scale > 5 || vertical.scale < 0.2 || vertical.scale > 5
    || horizontal.scale / vertical.scale < 0.5 || horizontal.scale / vertical.scale > 2) {
    return unavailable("transform-out-of-bounds");
  }

  const xResidual = Math.sqrt(xPairs.reduce((sum, pair) => sum + (pair.target - (horizontal.scale * pair.source + horizontal.offset)) ** 2, 0) / xPairs.length)
    / Math.max(1, ...observedLines.map((line) => line.width));
  const yResidual = Math.sqrt(yPairs.reduce((sum, pair) => sum + (pair.target - (vertical.scale * pair.source + vertical.offset)) ** 2, 0) / yPairs.length)
    / Math.max(1, ...observedLines.map((line) => line.height));
  const residual = Math.max(xResidual, yResidual);
  const confidence = referenceLines.length >= 2 && residual <= 0.12 ? "medium" : "low";
  return {
    available: true,
    reason: null,
    confidence,
    residual,
    transform: {
      kind: "bounded-axis-scale-translation",
      scaleX: horizontal.scale,
      scaleY: vertical.scale,
      translateX: horizontal.offset,
      translateY: vertical.offset,
      rotationDegrees: 0,
      shear: 0,
    },
  };
}

function blankRuns(mask, width, height, line) {
  const left = Math.max(0, Math.floor(line.x));
  const right = Math.min(width - 1, Math.ceil(line.x + line.width));
  const top = Math.max(0, Math.floor(line.y));
  const bottom = Math.min(height - 1, Math.ceil(line.y + line.height));
  const runs = [];
  let start = null;
  for (let x = left; x <= right; x += 1) {
    let hasInk = false;
    for (let y = top; y <= bottom; y += 1) {
      if (mask[y * width + x]) {
        hasInk = true;
        break;
      }
    }
    if (!hasInk && start === null) start = x;
    if (hasInk && start !== null) {
      runs.push({ left: start, right: x - 1, width: x - start, center: (start + x - 1) / 2 });
      start = null;
    }
  }
  if (start !== null) runs.push({ left: start, right, width: right - start + 1, center: (start + right) / 2 });
  return runs;
}

export function measureReferenceWordSpacing(referenceLines, observedLines, mask, width, height, fit) {
  if (!fit?.available || fit.confidence !== "medium") {
    return { available: false, reason: "low-fit-confidence", confidence: "unavailable", referenceUsed: true, observations: [] };
  }
  if (!Array.isArray(referenceLines) || referenceLines.length !== observedLines?.length
    || !mask || mask.length !== width * height || !Number.isInteger(width) || !Number.isInteger(height)) {
    return { available: false, reason: "invalid-analysis-input", confidence: "unavailable", referenceUsed: true, observations: [] };
  }
  const boundaries = referenceLines.flatMap((line, lineIndex) => (line.wordBoundaries ?? []).map((boundary, boundaryIndex) => ({ line, lineIndex, boundary, boundaryIndex })));
  if (boundaries.length === 0) return { available: false, reason: "no-word-boundaries", confidence: "unavailable", referenceUsed: true, observations: [] };

  const observations = [];
  const gapsByLine = observedLines.map((line) => blankRuns(mask, width, height, line));
  for (const { line, lineIndex, boundary, boundaryIndex } of boundaries) {
    const observedLine = observedLines[lineIndex];
    if (!observedLine || !Number.isFinite(boundary.center) || !Number.isFinite(boundary.width) || boundary.width <= 0) {
      return { available: false, reason: "invalid-word-boundary", confidence: "unavailable", referenceUsed: true, observations: [] };
    }
    const expectedCenter = fit.transform.scaleX * boundary.center + fit.transform.translateX;
    const expectedWidth = fit.transform.scaleX * boundary.width;
    const radius = Math.max(expectedWidth * 1.5, observedLine.height * 0.25);
    const minWidth = Math.max(2, observedLine.height * 0.06);
    const candidates = gapsByLine[lineIndex]
      .filter((run) => run.width >= minWidth && Math.abs(run.center - expectedCenter) <= radius);
    if (candidates.length !== 1) {
      return { available: false, reason: candidates.length ? "ambiguous-word-boundary" : "word-gap-not-found", confidence: "unavailable", referenceUsed: true, observations: [] };
    }
    const observedGap = candidates[0];
    observations.push({
      line: lineIndex,
      boundary: boundaryIndex,
      expectedGapPx: expectedWidth,
      observedGapPx: observedGap.width,
      centerOffsetPx: observedGap.center - expectedCenter,
      ratio: observedGap.width / expectedWidth,
    });
  }

  const ratios = observations.map(({ ratio }) => ratio).sort((left, right) => left - right);
  const middle = Math.floor(ratios.length / 2);
  const value = ratios.length % 2 ? ratios[middle] : (ratios[middle - 1] + ratios[middle]) / 2;
  return {
    available: true,
    reason: null,
    value,
    unit: "observed-to-reference gap ratio",
    confidence: "medium",
    referenceUsed: true,
    method: "unique blank-column runs near predicted word boundaries",
    observations,
    limitations: ["This measures spacing only; it does not recognize or score handwriting forms."],
  };
}

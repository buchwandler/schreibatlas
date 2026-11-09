import assert from "node:assert/strict";
import test from "node:test";
import { analyzeWorksheetWriting, applyHomography, detectWorksheetGeometry, fitConstrainedSimilarity, homographyFromPoints } from "../../tools/worksheet-analysis.mjs";
import { worksheetMarker, worksheetMarkerLayout } from "../../tools/worksheet.mjs";
import { analyzePixels } from "../../tools/photo-analysis.mjs";

function worksheetMetadata(widthMm = 210, heightMm = 297) {
  return {
    worksheetId: "SAW1-TEST0001",
    worksheetMarker: {
      ...worksheetMarker,
      pageWidthMm: widthMm,
      pageHeightMm: heightMm,
      positionsMm: worksheetMarkerLayout(widthMm, heightMm),
    },
    settings: { text: "oo", guides: "none" },
    writingRegionMm: {
      left: 10,
      right: 90,
      blankRows: [{ id: "1.1", top: 20, baseline: 49, xHeight: 32, height: 40 }],
    },
  };
}

function drawMarker(rgba, width, centerX, centerY, size, code) {
  const border = Math.round(size * 0.14);
  const left = Math.round(centerX - size / 2);
  const top = Math.round(centerY - size / 2);
  const setPixel = (x, y, value) => {
    if (x < 0 || y < 0 || x >= width) return;
    const offset = (y * width + x) * 4;
    rgba[offset] = value;
    rgba[offset + 1] = value;
    rgba[offset + 2] = value;
    rgba[offset + 3] = 255;
  };
  const rect = (x, y, rectWidth, rectHeight, value) => {
    for (let py = y; py < y + rectHeight; py += 1) for (let px = x; px < x + rectWidth; px += 1) setPixel(px, py, value);
  };
  rect(left, top, size, size, 0);
  rect(left + border, top + border, size - border * 2, size - border * 2, 255);
  const inner = size - border * 2;
  const gap = Math.max(1, Math.round(inner * 0.08));
  const cell = inner / 2;
  for (let index = 0; index < code; index += 1) {
    const x = Math.round(left + border + (index % 2) * cell + gap / 2);
    const y = Math.round(top + border + Math.floor(index / 2) * cell + gap / 2);
    const moduleSize = Math.max(1, Math.round(cell - gap));
    rect(x, y, moduleSize, moduleSize, 0);
  }
}

function syntheticWorksheet() {
  const width = 800;
  const height = 1000;
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < rgba.length; index += 4) {
    rgba[index] = 255;
    rgba[index + 1] = 255;
    rgba[index + 2] = 255;
    rgba[index + 3] = 255;
  }
  const pageLeft = 40;
  const pageTop = 30;
  const scale = 3;
  const metadata = worksheetMetadata();
  for (const marker of metadata.worksheetMarker.positionsMm) {
    drawMarker(rgba, width, pageLeft + marker.x * scale, pageTop + marker.y * scale, worksheetMarker.sizeMm * scale, marker.code);
  }
  return { rgba, width, height, expectedCorners: [
    { x: pageLeft, y: pageTop },
    { x: pageLeft + 210 * scale, y: pageTop },
    { x: pageLeft + 210 * scale, y: pageTop + 297 * scale },
    { x: pageLeft, y: pageTop + 297 * scale },
  ], metadata };
}

function fillPolygon(rgba, width, height, points, value) {
  const minX = Math.max(0, Math.floor(Math.min(...points.map((point) => point.x))));
  const maxX = Math.min(width - 1, Math.ceil(Math.max(...points.map((point) => point.x))));
  const minY = Math.max(0, Math.floor(Math.min(...points.map((point) => point.y))));
  const maxY = Math.min(height - 1, Math.ceil(Math.max(...points.map((point) => point.y))));
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      let inside = false;
      for (let index = 0, previous = points.length - 1; index < points.length; previous = index, index += 1) {
        const first = points[index];
        const second = points[previous];
        if ((first.y > y) !== (second.y > y) && x < ((second.x - first.x) * (y - first.y)) / (second.y - first.y) + first.x) inside = !inside;
      }
      if (!inside) continue;
      const offset = (y * width + x) * 4;
      rgba[offset] = value;
      rgba[offset + 1] = value;
      rgba[offset + 2] = value;
      rgba[offset + 3] = 255;
    }
  }
}

function drawProjectedRect(rgba, width, height, transform, x, y, rectWidth, rectHeight, value) {
  const polygon = [
    { x, y },
    { x: x + rectWidth, y },
    { x: x + rectWidth, y: y + rectHeight },
    { x, y: y + rectHeight },
  ].map((point) => applyHomography(transform, point));
  fillPolygon(rgba, width, height, polygon, value);
}
function drawProjectedCircle(rgba, width, height, transform, centerX, centerY, radius, value) {
  const points = Array.from({ length: 32 }, (_, index) => {
    const angle = (index / 32) * Math.PI * 2;
    return applyHomography(transform, { x: centerX + Math.cos(angle) * radius, y: centerY + Math.sin(angle) * radius });
  });
  fillPolygon(rgba, width, height, points, value);
}


function syntheticPerspectiveWorksheet() {
  const width = 800;
  const height = 1000;
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < rgba.length; index += 4) rgba[index] = rgba[index + 1] = rgba[index + 2] = rgba[index + 3] = 255;
  const pageCorners = [{ x: 0, y: 0 }, { x: 210, y: 0 }, { x: 210, y: 297 }, { x: 0, y: 297 }];
  const photoCorners = [{ x: 76, y: 68 }, { x: 720, y: 102 }, { x: 676, y: 932 }, { x: 92, y: 902 }];
  const pageToPhoto = homographyFromPoints(pageCorners, photoCorners);
  const metadata = worksheetMetadata();
  const size = worksheetMarker.sizeMm;
  const border = size * 0.14;
  const inner = size - border * 2;
  const gap = inner * 0.08;
  const cell = inner / 2;
  for (const marker of metadata.worksheetMarker.positionsMm) {
    const left = marker.x - size / 2;
    const top = marker.y - size / 2;
    drawProjectedRect(rgba, width, height, pageToPhoto, left, top, size, size, 0);
    drawProjectedRect(rgba, width, height, pageToPhoto, left + border, top + border, inner, inner, 255);
    for (let index = 0; index < marker.code; index += 1) {
      const moduleX = left + border + (index % 2) * cell + gap / 2;
      const moduleY = top + border + Math.floor(index / 2) * cell + gap / 2;
      drawProjectedRect(rgba, width, height, pageToPhoto, moduleX, moduleY, cell - gap, cell - gap, 0);
    }
  }
  return { rgba, width, height, expectedCorners: photoCorners, metadata, pageToPhoto };
}

test("homography maps four known correspondences and extrapolates page corners", () => {
  const source = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
  const target = [{ x: 5, y: 8 }, { x: 25, y: 8 }, { x: 27, y: 28 }, { x: 5, y: 28 }];
  const transform = homographyFromPoints(source, target);
  assert.ok(transform);
  assert.ok(Math.abs(applyHomography(transform, { x: 0, y: 0 }).x - target[0].x) < 1e-8);
  assert.ok(Math.abs(applyHomography(transform, { x: 0, y: 0 }).y - target[0].y) < 1e-8);
  assert.ok(Math.abs(applyHomography(transform, { x: 10, y: 10 }).x - target[2].x) < 1e-8);
  assert.ok(Math.abs(applyHomography(transform, { x: 10, y: 10 }).y - target[2].y) < 1e-8);
});

test("worksheet marker detection rectifies a controlled printed-page image", () => {
  const fixture = syntheticWorksheet();
  const result = detectWorksheetGeometry(fixture.rgba, fixture.width, fixture.height, fixture.metadata);
  assert.equal(result.status, "recognized");
  assert.ok(result.confidence >= 0.72);
  assert.equal(result.worksheetId, fixture.metadata.worksheetId);
  assert.equal(result.pageCorners.length, 4);
  for (const [index, corner] of result.pageCorners.entries()) {
    assert.ok(Math.abs(corner.x - fixture.expectedCorners[index].x) < 3);
    assert.ok(Math.abs(corner.y - fixture.expectedCorners[index].y) < 3);
  }
});

test("four fiducials recover a controlled projective page transform", () => {
  const fixture = syntheticPerspectiveWorksheet();
  const result = detectWorksheetGeometry(fixture.rgba, fixture.width, fixture.height, fixture.metadata);
  assert.equal(result.status, "recognized");
  for (const [index, corner] of result.pageCorners.entries()) {
    assert.ok(Math.abs(corner.x - fixture.expectedCorners[index].x) < 10);
    assert.ok(Math.abs(corner.y - fixture.expectedCorners[index].y) < 10);
  }
});

test("confident worksheet geometry calibrates blank rows and refuses uncertain repeated-shape alignment", () => {
  const fixture = syntheticPerspectiveWorksheet();
  for (const centerX of [30, 70]) {
    drawProjectedCircle(fixture.rgba, fixture.width, fixture.height, fixture.pageToPhoto, centerX, 36, 2, 0);
    drawProjectedCircle(fixture.rgba, fixture.width, fixture.height, fixture.pageToPhoto, centerX, 36, 0.8, 255);
  }
  const geometry = detectWorksheetGeometry(fixture.rgba, fixture.width, fixture.height, fixture.metadata);
  assert.equal(geometry.status, "recognized");
  const image = analyzePixels(fixture.rgba, fixture.width, fixture.height, geometry.pageCorners, { targetSizeMm: geometry.pageSizeMm, skipDeskew: true });
  const writing = analyzeWorksheetWriting(image.mask, image.width, image.height, fixture.metadata, geometry.confidence);
  assert.equal(writing.status, "measured");
  assert.equal(writing.rows[0].componentCount, 2);
  assert.equal(writing.repeatedLetterAnalysis.status, "unavailable");
  assert.equal("components" in writing.rows[0], false);
});

test("marker recognition refuses missing marker evidence instead of guessing a page crop", () => {
  const width = 100;
  const height = 120;
  const rgba = new Uint8ClampedArray(width * height * 4).fill(255);
  const result = detectWorksheetGeometry(rgba, width, height, worksheetMetadata());
  assert.equal(result.status, "unavailable");
  assert.equal(result.pageCorners, undefined);
});

test("constrained similarity fitting accepts bounded uniform changes and rejects shear", () => {
  const reference = [{ x: 0.3, y: 0.3 }, { x: 0.7, y: 0.3 }, { x: 0.5, y: 0.7 }];
  const angle = 5 * Math.PI / 180;
  const sample = reference.map(({ x, y }) => ({
    x: 0.02 + 1.05 * (Math.cos(angle) * x - Math.sin(angle) * y),
    y: -0.01 + 1.05 * (Math.sin(angle) * x + Math.cos(angle) * y),
  }));
  const fitted = fitConstrainedSimilarity(reference, sample);
  assert.equal(fitted.status, "available");
  assert.ok(fitted.residual < 1e-8);
  const sheared = reference.map(({ x, y }) => ({ x: x + 1.5 * y, y }));
  assert.equal(fitConstrainedSimilarity(reference, sheared).status, "unavailable");
});

test("repeated-letter analysis is confidence-gated and measures isolated local shapes only", () => {
  const width = 100;
  const height = 100;
  const mask = new Uint8Array(width * height);
  const drawRing = (centerX, centerY) => {
    for (let y = centerY - 7; y <= centerY + 7; y += 1) {
      for (let x = centerX - 7; x <= centerX + 7; x += 1) {
        const distance = Math.hypot(x - centerX, y - centerY);
        if (distance >= 4 && distance <= 7) mask[y * width + x] = 1;
      }
    }
  };
  drawRing(30, 36);
  drawRing(58, 36);
  drawRing(30, 76);
  drawRing(58, 76);
  const metadata = worksheetMetadata(100, 100);
  metadata.writingRegionMm.blankRows.push({ id: "1.2", top: 60, baseline: 89, xHeight: 72, height: 40 });
  const measured = analyzeWorksheetWriting(mask, width, height, metadata, 0.95);
  assert.equal(measured.status, "measured");
  assert.equal(measured.rows[0].components.length, 2);
  assert.ok(measured.rows[0].components[0].skeletonPixels > 0);
  assert.ok(measured.rows[0].components[0].perimeter > 0);
  assert.equal(measured.rows[0].componentCount, 2);
  assert.equal(measured.rows[1].componentCount, 2);
  assert.equal(measured.multiLineDiagnostics.measuredRows, 2);
  assert.ok(Number.isFinite(measured.multiLineDiagnostics.baselineOffsetSpreadMm));
  assert.equal(measured.repeatedLetterAnalysis.status, "available");
  assert.equal(measured.repeatedLetterAnalysis.character, "o");
  assert.deepEqual(measured.repeatedLetterAnalysis.clusters, [{ count: 2 }]);
  assert.equal(measured.repeatedLetterAnalysis.constrainedFits[0].status, "available");
  assert.equal(measured.qualityRating, null);
  const mergedMask = mask.slice();
  for (let x = 37; x <= 51; x += 1) mergedMask[36 * width + x] = 1;
  const refused = analyzeWorksheetWriting(mergedMask, width, height, worksheetMetadata(100, 100), 0.95);
  assert.equal(refused.repeatedLetterAnalysis.status, "unavailable");
  assert.equal("components" in refused.rows[0], false);
  assert.equal(analyzeWorksheetWriting(mask, width, height, metadata, 0.5).status, "unavailable");
});

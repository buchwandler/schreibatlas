import assert from "node:assert/strict";
import test from "node:test";
import { analyzePixels, isValidQuadrilateral } from "../../tools/photo-analysis.mjs";

function whiteImage(width, height) {
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < pixels.length; index += 4) {
    pixels[index] = 255;
    pixels[index + 1] = 255;
    pixels[index + 2] = 255;
    pixels[index + 3] = 255;
  }
  return pixels;
}

function paintRect(pixels, width, x0, y0, x1, y1, value = 0) {
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      const offset = (y * width + x) * 4;
      pixels[offset] = value;
      pixels[offset + 1] = value;
      pixels[offset + 2] = value;
      pixels[offset + 3] = 255;
    }
  }
}

test("manual crop corners require an ordered convex quadrilateral", () => {
  const rectangle = [{ x: 0, y: 0 }, { x: 19, y: 0 }, { x: 19, y: 19 }, { x: 0, y: 19 }];
  assert.equal(isValidQuadrilateral(rectangle, 20, 20), true);
  assert.equal(isValidQuadrilateral([rectangle[0], rectangle[2], rectangle[1], rectangle[3]], 20, 20), false);
  assert.equal(isValidQuadrilateral(rectangle.map((point) => ({ x: point.x + 30, y: point.y })), 20, 20), false);
});

test("four-corner perspective correction maps a trapezoidal page to a rectangular raster", () => {
  const width = 50;
  const height = 40;
  const pixels = whiteImage(width, height);
  paintRect(pixels, width, 15, 12, 35, 27);
  const corners = [{ x: 5, y: 4 }, { x: 44, y: 7 }, { x: 40, y: 34 }, { x: 8, y: 36 }];
  const result = analyzePixels(pixels, width, height, corners);
  assert.ok(result.width > 35 && result.width < 45);
  assert.ok(result.height > 25 && result.height < 35);
  assert.ok(result.foregroundPixels > 0);
});

test("known worksheet dimensions constrain rectified output aspect and skip redundant deskew", () => {
  const width = 100;
  const height = 80;
  const corners = [{ x: 0, y: 0 }, { x: width - 1, y: 0 }, { x: width - 1, y: height - 1 }, { x: 0, y: height - 1 }];
  const result = analyzePixels(whiteImage(width, height), width, height, corners, { targetSizeMm: { width: 210, height: 297 }, skipDeskew: true });
  assert.ok(Math.abs(result.width / result.height - 210 / 297) < 0.005);
  assert.equal(result.deskewDegrees, 0);
  assert.equal(result.deskewConfidence, "medium");
});

test("pixel pipeline rectifies, thresholds, detects line regions, and reports only lower-edge candidates", () => {
  const width = 160;
  const height = 100;
  const pixels = whiteImage(width, height);
  paintRect(pixels, width, 15, 25, 140, 35);
  paintRect(pixels, width, 15, 60, 140, 70);
  const corners = [{ x: 0, y: 0 }, { x: width - 1, y: 0 }, { x: width - 1, y: height - 1 }, { x: 0, y: height - 1 }];
  const result = analyzePixels(pixels, width, height, corners);
  assert.equal(result.width, width);
  assert.equal(result.height, height);
  assert.ok(result.threshold < 255);
  assert.equal(result.lines.length, 2);
  assert.equal(result.lines[0].height, 11);
  assert.equal(result.lines[0].baselineCandidate.source, "lower-ink-envelope");
  assert.equal(result.lines[0].baselineCandidate.confidence, "low");
  assert.ok(Number.isFinite(result.lines[0].baselineCandidate.residualStdDev));
  assert.equal(result.lineSpacing.length, 1);
  assert.ok(result.foregroundPixels > 0);
  assert.equal(result.mask.length, width * height);
  assert.equal(result.preview.length, width * height * 4);
});

test("deskew estimates a small line angle and a white image produces no false text lines", () => {
  const width = 200;
  const height = 100;
  const pixels = whiteImage(width, height);
  for (let x = 20; x < 180; x += 1) {
    const baseline = 30 + Math.round((x - 20) * Math.tan(3 * Math.PI / 180));
    paintRect(pixels, width, x, baseline - 1, x, baseline + 1);
  }
  const corners = [{ x: 0, y: 0 }, { x: width - 1, y: 0 }, { x: width - 1, y: height - 1 }, { x: 0, y: height - 1 }];
  const deskewed = analyzePixels(pixels, width, height, corners);
  assert.ok(Math.abs(deskewed.deskewDegrees - 3) <= 1);
  assert.equal(deskewed.lines.length, 1);

  const blank = analyzePixels(whiteImage(width, height), width, height, corners);
  assert.equal(blank.foregroundPixels, 0);
  assert.deepEqual(blank.lines, []);
});

test("uniform dark images do not become false ink lines when Otsu has no contrast", () => {
  const width = 20;
  const height = 20;
  const pixels = whiteImage(width, height);
  for (let index = 0; index < pixels.length; index += 4) {
    pixels[index] = 32;
    pixels[index + 1] = 32;
    pixels[index + 2] = 32;
  }
  const corners = [{ x: 0, y: 0 }, { x: width - 1, y: 0 }, { x: width - 1, y: height - 1 }, { x: 0, y: height - 1 }];
  const result = analyzePixels(pixels, width, height, corners);
  assert.equal(result.threshold, null);
  assert.equal(result.foregroundPixels, 0);
  assert.deepEqual(result.lines, []);
});

test("analysis rejects malformed crop geometry before pixel processing", () => {
  const pixels = whiteImage(20, 20);
  assert.throws(() => analyzePixels(pixels, 20, 20, [{ x: 0, y: 0 }, { x: 19, y: 19 }, { x: 19, y: 0 }, { x: 0, y: 19 }]), /four ordered crop corners/);
});

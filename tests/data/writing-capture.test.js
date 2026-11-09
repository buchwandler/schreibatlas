import assert from "node:assert/strict";
import test from "node:test";
import { measureCapture, splitCaptureStrokes } from "../../tools/writing-capture.mjs";

const samples = [
  { x: 10, y: 20, t: 0, pressure: 0.4, pointerType: "pen", penDown: true },
  { x: 13, y: 24, t: 8, pressure: 0.6, pointerType: "pen", penDown: true },
  { x: 13, y: 24, t: 9, pointerType: "pen", penDown: false },
  { x: 30, y: 40, t: 20, pointerType: "mouse", penDown: true },
  { x: 34, y: 40, t: 26, pointerType: "mouse", penDown: true },
  { x: 34, y: 40, t: 27, pointerType: "mouse", penDown: false },
];

test("pen-up samples separate strokes and pressure remains optional", () => {
  const strokes = splitCaptureStrokes(samples);
  assert.deepEqual(strokes.map((stroke) => stroke.length), [2, 2]);
  const metrics = measureCapture(samples);
  assert.equal(metrics.strokeCount, 2);
  assert.equal(metrics.sampleCount, 6);
  assert.equal(metrics.pressureSampleCount, 2);
  assert.equal(metrics.width, 24);
  assert.equal(metrics.height, 20);
  assert.equal(metrics.durationMs, 27);
  assert.equal(metrics.pathLength, Math.hypot(3, 4) + 4);
});

test("empty and one-point captures report only supportable measurements", () => {
  assert.deepEqual(measureCapture([]), {
    strokeCount: 0,
    sampleCount: 0,
    pressureSampleCount: 0,
    pathLength: 0,
    width: 0,
    height: 0,
    durationMs: 0,
    bounds: null,
  });
  const metrics = measureCapture([{ x: 4, y: 7, t: 2, pointerType: "touch", penDown: true }]);
  assert.equal(metrics.strokeCount, 1);
  assert.equal(metrics.pathLength, 0);
  assert.deepEqual(metrics.bounds, { minX: 4, minY: 7, maxX: 4, maxY: 7 });
});

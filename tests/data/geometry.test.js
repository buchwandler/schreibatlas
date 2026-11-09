import assert from "node:assert/strict";
import test from "node:test";
import { fontSizeForXHeight, normalizeOutline, normalizePoint, sharedViewBox } from "../../tools/geometry.mjs";

const outlineA = { path: "M 0 800 L 400 400 Z", view_box: [0, 0, 400, 1000], baseline: 800, x_height: 400 };
const outlineB = { path: "M 0 80 L 60 40 Z", view_box: [0, 0, 60, 100], baseline: 80, x_height: 40 };

test("outline coordinates map their source baseline and x-height to shared normalized coordinates", () => {
  assert.deepEqual(normalizePoint(outlineA, 0, 800), { x: 0, y: 0 });
  assert.deepEqual(normalizePoint(outlineA, 0, 400), { x: 0, y: 1 });
  assert.deepEqual(normalizePoint(outlineB, 0, 80), { x: 0, y: 0 });
  assert.deepEqual(normalizePoint(outlineB, 0, 40), { x: 0, y: 1 });
  assert.equal(normalizeOutline(outlineA).bounds.maxX, 1);
  assert.equal(normalizeOutline(outlineB).bounds.maxX, 1.5);
});

test("shared side-by-side and overlay viewBox is independent of CSS font size", () => {
  const a = normalizeOutline(outlineA);
  const b = normalizeOutline(outlineB);
  const viewBox = sharedViewBox([a, b], [{ ascender: 2.5, descender: -0.4 }]);
  assert.ok(Math.abs(viewBox.world.maxY - 2.58) < 1e-9);
  assert.ok(Math.abs(viewBox.world.minY + 0.58) < 1e-9);
  assert.ok(Math.abs(viewBox.width - 1.66) < 1e-9);
  assert.ok(Math.abs(viewBox.height - 3.16) < 1e-9);
});

test("outlines with inverted or missing x-height calibration are rejected", () => {
  assert.throws(() => normalizePoint({ ...outlineA, baseline: 400, x_height: 800 }, 0, 400), /baseline must be below/);
});

test("font x-height is mapped from measured em calibration", () => {
  assert.equal(fontSizeForXHeight(0.5), 2);
  assert.equal(fontSizeForXHeight(0.25), 4);
  assert.throws(() => fontSizeForXHeight(0), /calibration must be positive/);
});

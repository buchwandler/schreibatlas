// SPDX-License-Identifier: Apache-2.0
import assert from "node:assert/strict";
import test from "node:test";
import { fitReferenceText, measureReferenceWordSpacing } from "../../tools/photo-reference.mjs";

const referenceLines = [
  { text: "sample", inkLeft: 2, inkRight: 102, ascent: 70, descent: 10, baseline: 80, wordBoundaries: [] },
  { text: "text", inkLeft: 2, inkRight: 102, ascent: 70, descent: 10, baseline: 230, wordBoundaries: [] },
];

const observedLines = [
  { x: 17.4, y: 33, width: 120, height: 64 },
  { x: 17.4, y: 153, width: 120, height: 64 },
];

test("reference text uses bounded global axis scaling and translation for matching line geometry", () => {
  const fit = fitReferenceText(referenceLines, observedLines);
  assert.equal(fit.available, true);
  assert.equal(fit.confidence, "medium");
  assert.ok(Math.abs(fit.transform.scaleX - 1.2) < 1e-9);
  assert.ok(Math.abs(fit.transform.scaleY - 0.8) < 1e-9);
  assert.ok(Math.abs(fit.transform.translateX - 15) < 1e-9);
  assert.ok(Math.abs(fit.transform.translateY - 25) < 1e-9);
  assert.equal(fit.transform.rotationDegrees, 0);
  assert.equal(fit.transform.shear, 0);
});

test("reference fitting rejects scale and line-count mismatches instead of forcing alignment", () => {
  const tooWide = fitReferenceText(referenceLines, observedLines.map((line) => ({ ...line, width: 600 })));
  assert.equal(tooWide.available, false);
  assert.equal(tooWide.reason, "transform-out-of-bounds");
  const wrongLineCount = fitReferenceText(referenceLines, observedLines.slice(0, 1));
  assert.equal(wrongLineCount.available, false);
  assert.equal(wrongLineCount.reason, "line-count-mismatch");
});

test("single-line fits do not pass the confidence gate for word-spacing measurements", () => {
  const singleLine = fitReferenceText(referenceLines.slice(0, 1), observedLines.slice(0, 1));
  assert.equal(singleLine.available, true);
  assert.equal(singleLine.confidence, "low");
  const result = measureReferenceWordSpacing(
    [{ ...referenceLines[0], wordBoundaries: [{ center: 30, width: 8 }] }],
    observedLines.slice(0, 1),
    new Uint8Array(200 * 100),
    200,
    100,
    singleLine,
  );
  assert.equal(result.available, false);
  assert.equal(result.reason, "low-fit-confidence");
});

test("word gaps are measured only when a unique blank run occurs near the shaped boundary", () => {
  const lines = [
    { text: "one two", inkLeft: 10, inkRight: 90, ascent: 10, descent: 5, baseline: 15, wordBoundaries: [{ center: 30, width: 8 }] },
    { text: "three", inkLeft: 10, inkRight: 90, ascent: 10, descent: 5, baseline: 37.5, wordBoundaries: [] },
  ];
  const detections = [{ x: 10, y: 5, width: 80, height: 20 }, { x: 10, y: 35, width: 80, height: 20 }];
  const fit = fitReferenceText(lines, detections);
  assert.equal(fit.confidence, "medium");
  const width = 120;
  const height = 60;
  const mask = new Uint8Array(width * height);
  for (let y = 6; y <= 24; y += 1) {
    for (let x = 10; x <= 25; x += 1) mask[y * width + x] = 1;
    for (let x = 34; x <= 50; x += 1) mask[y * width + x] = 1;
    for (let x = 60; x <= 90; x += 1) mask[y * width + x] = 1;
  }
  for (let y = 36; y <= 54; y += 1) {
    for (let x = 10; x <= 90; x += 1) mask[y * width + x] = 1;
  }
  const result = measureReferenceWordSpacing(lines, detections, mask, width, height, fit);
  assert.equal(result.available, true);
  assert.equal(result.confidence, "medium");
  assert.equal(result.observations.length, 1);
  assert.ok(Math.abs(result.observations[0].observedGapPx - 8) <= 1);
});

test("ambiguous or absent image gaps remain unavailable", () => {
  const lines = [
    { text: "one two", inkLeft: 10, inkRight: 90, ascent: 10, descent: 5, baseline: 15, wordBoundaries: [{ center: 30, width: 8 }] },
    { text: "three", inkLeft: 10, inkRight: 90, ascent: 10, descent: 5, baseline: 37.5, wordBoundaries: [] },
  ];
  const detections = [{ x: 10, y: 5, width: 80, height: 20 }, { x: 10, y: 35, width: 80, height: 20 }];
  const fit = fitReferenceText(lines, detections);
  const mask = new Uint8Array(120 * 60);
  const result = measureReferenceWordSpacing(lines, detections, mask, 120, 60, fit);
  assert.equal(result.available, false);
  assert.equal(result.reason, "word-gap-not-found");
});

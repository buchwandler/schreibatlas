// SPDX-License-Identifier: Apache-2.0
import assert from "node:assert/strict";
import test from "node:test";
import { compareVerifiedStrokes } from "../../tools/stroke-comparison.mjs";

const reference = {
  verification: "verified",
  sources: ["src-synthetic-test-fixture"],
  strokes: [
    { penDown: true, points: [{ x: 0.1, y: 0.4 }, { x: 0.25, y: 0.4 }, { x: 0.4, y: 0.4 }], timingMs: 100 },
    { penDown: true, points: [{ x: 0.4, y: 0.4 }, { x: 0.4, y: 0.6 }, { x: 0.4, y: 0.8 }], timingMs: 200 },
  ],
};

function perturb(points, scale = 0.8, translate = { x: 0.5, y: 0.1 }) {
  return points.map((point, index) => ({
    x: point.x * scale + translate.x,
    y: point.y * scale + translate.y,
    t: index * 50,
  }));
}

const captured = reference.strokes.map((stroke, index) => perturb(stroke.points, 0.8, { x: 0.5, y: 0.1 + index * 0.02 }));
captured[1] = captured[1].map((point, index) => ({ ...point, t: 150 + index * 100 }));

test("synthetic translated and uniformly scaled movement is compared without non-uniform fitting", () => {
  const result = compareVerifiedStrokes(reference, captured);
  assert.equal(result.available, true);
  assert.equal(result.alignment.kind, "uniform-scale-translation");
  assert.equal(result.alignment.rotationDegrees, 0);
  assert.equal(result.alignment.shear, 0);
  for (const name of ["start", "direction", "order", "penLifts", "rhythm"]) {
    assert.equal(result.observations[name].status, "match", name);
    assert.ok(result.observations[name].confidence >= 0.7, name);
  }
});

test("reversed drawing direction and stroke order are separately identified", () => {
  const reverseDirection = captured.map((stroke) => [...stroke].reverse());
  const directionResult = compareVerifiedStrokes(reference, reverseDirection);
  assert.equal(directionResult.observations.direction.status, "different");
  assert.equal(directionResult.observations.order.status, "match");

  const reverseOrder = [captured[1], captured[0]];
  const orderResult = compareVerifiedStrokes(reference, reverseOrder);
  assert.equal(orderResult.observations.order.status, "different");
});

test("out-of-range scale does not produce geometry observations", () => {
  const enlarged = captured.map((stroke) => stroke.map((point) => ({ ...point, x: point.x * 4, y: point.y * 4 })));
  const result = compareVerifiedStrokes(reference, enlarged);
  assert.equal(result.available, true);
  assert.equal(result.reason, "bounded-fit-outside-range");
  assert.equal(result.observations.start.status, "unavailable");
  assert.equal(result.observations.direction.status, "unavailable");
  assert.equal(result.observations.order.status, "unavailable");
  assert.equal(result.observations.penLifts.status, "match");
});

test("missing or unsourced stroke records produce no inferred movement observations", () => {
  for (const item of [
    null,
    { ...reference, verification: "source-backed" },
    { ...reference, sources: [] },
  ]) {
    const result = compareVerifiedStrokes(item, captured);
    assert.equal(result.available, false);
    assert.ok(Object.values(result.observations).every((observation) => observation.status === "unavailable" && observation.confidence === null));
  }
});

test("rhythm remains unavailable without measured reference timings", () => {
  const untimedReference = { ...reference, strokes: reference.strokes.map((stroke) => ({ ...stroke, timingMs: null })) };
  const result = compareVerifiedStrokes(untimedReference, captured);
  assert.equal(result.observations.rhythm.status, "unavailable");
});

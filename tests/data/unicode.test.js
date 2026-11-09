import assert from "node:assert/strict";
import test from "node:test";
import { glyphFileName, glyphRouteSlug, unicodeCodePoints } from "../../tools/unicode.mjs";

test("Unicode file names use uppercase code points rather than literal glyphs", () => {
  assert.equal(glyphFileName("a"), "0061.yaml");
  assert.equal(glyphFileName("ß"), "00DF.yaml");
});

test("Unicode routes use stable lowercase code-point slugs", () => {
  assert.equal(glyphRouteSlug("a"), "u0061");
  assert.equal(glyphRouteSlug("ß"), "u00df");
});

test("combining sequences preserve each code point in file names and routes", () => {
  const sequence = "a\u0308";
  assert.deepEqual(unicodeCodePoints(sequence), ["U+0061", "U+0308"]);
  assert.equal(glyphFileName(sequence), "0061-0308.yaml");
  assert.equal(glyphRouteSlug(sequence), "u0061-0308");
});

// SPDX-License-Identifier: Apache-2.0
import assert from "node:assert/strict";
import test from "node:test";
import { fontCapability, fontFeatureSettings, fontSupportsText, supportsRequiredFontFeatures } from "../../src/lib/font-capabilities.ts";

test("font capability labels distinguish all four rendering states", () => {
  assert.equal(fontCapability(true, true), "both");
  assert.equal(fontCapability(true, false), "vector");
  assert.equal(fontCapability(false, true), "font");
  assert.equal(fontCapability(false, false), "none");
});

test("font character coverage rejects any unsupported visible character", () => {
  const font = { supported_characters: ["S", "c", "h", "u", "l", "e", "ß", " "] };
  assert.equal(fontSupportsText(font, "Schule ß"), true);
  assert.equal(fontSupportsText(font, "Schule 😀"), false);
});

test("OpenType settings are limited to explicitly required features", () => {
  assert.equal(fontFeatureSettings({ shaping: { required_features: ["calt", "kern"] } }), '"calt" 1, "kern" 1');
  assert.equal(fontFeatureSettings({}), "");
});

test("required feature support fails closed when the browser rejects the syntax", () => {
  const original = globalThis.CSS;
  Object.defineProperty(globalThis, "CSS", { configurable: true, value: { supports: (_property, value) => value !== '"calt" 1' } });
  try {
    assert.equal(supportsRequiredFontFeatures({ shaping: { required_features: ["calt"] } }), false);
    assert.equal(supportsRequiredFontFeatures({}), true);
  } finally {
    if (original === undefined) delete globalThis.CSS;
    else Object.defineProperty(globalThis, "CSS", { configurable: true, value: original });
  }
});

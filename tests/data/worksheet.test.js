// SPDX-License-Identifier: Apache-2.0
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import test from "node:test";
import { decodeWorksheetSettings, encodeWorksheetSettings, layoutWorksheet, normalizeWorksheetSettings, worksheetId, worksheetMarkerLayout, worksheetPresets } from "../../tools/worksheet.mjs";

test("worksheet settings encode deterministically and round-trip Unicode without a network query", () => {
  const settings = normalizeWorksheetSettings({
    model: "demo-round",
    paper: "Letter",
    marginMm: 16,
    rowHeightMm: 20,
    guides: "baseline",
    text: "ß <script> & قلم",
    referenceRow: false,
    tracingRows: 1,
    blankRows: 2,
    repetitions: 2,
  }, ["demo-round"]);
  const encoded = encodeWorksheetSettings(settings);
  assert.equal(encoded, encodeWorksheetSettings(settings));
  assert.match(encoded, /^#worksheet=[A-Za-z0-9_-]+$/);
  assert.deepEqual(decodeWorksheetSettings(encoded, ["demo-round"]), settings);
  assert.equal(decodeWorksheetSettings("#worksheet=invalid!", ["demo-round"]), null);
});

test("worksheet presets use only recorded source-backed Volksschrift outlines", () => {
  for (const preset of worksheetPresets) {
    assert.equal(preset.model, "de-volksschrift");
    for (const character of [...preset.text]) {
      const codepoint = character.codePointAt(0);
      assert.ok(codepoint);
      const filename = new URL(`../../data/glyphs/${preset.model}/${codepoint.toString(16).toUpperCase().padStart(4, "0")}.yaml`, import.meta.url);
      const glyph = parse(readFileSync(filename, "utf8"));
      assert.equal(glyph.model, preset.model);
      assert.equal(glyph.character, character);
      assert.ok(glyph.outline);
      assert.ok(glyph.sources.length);
    }
  }
});

test("worksheet marker geometry and IDs are deterministic for each page configuration", () => {
  const settings = normalizeWorksheetSettings({ model: "demo-round", text: "oooo" }, ["demo-round"]);
  const markers = worksheetMarkerLayout(210, 297);
  assert.deepEqual(markers.map((marker) => marker.code), [1, 2, 3, 4]);
  assert.equal(markers[0].x, 7);
  assert.equal(markers[2].y, 290);
  assert.equal(worksheetId(settings, "v1"), worksheetId(settings, "v1"));
  assert.notEqual(worksheetId(settings, "v1"), worksheetId({ ...settings, text: "eeee" }, "v1"));
});

test("worksheet layout is reproducible from its encoded settings and fits the page", () => {
  const settings = normalizeWorksheetSettings({
    model: "demo-round",
    paper: "Letter",
    marginMm: 16,
    rowHeightMm: 20,
    guides: "baseline-xheight",
    text: "abc",
    referenceRow: true,
    tracingRows: 2,
    blankRows: 2,
    repetitions: 2,
  }, ["demo-round"]);
  const originalLayout = layoutWorksheet(settings);
  const restored = decodeWorksheetSettings(encodeWorksheetSettings(settings), ["demo-round"]);
  assert.deepEqual(layoutWorksheet(restored), originalLayout);
  assert.equal(originalLayout.width, 215.9);
  assert.equal(originalLayout.rows.length, 10);
  assert.ok(originalLayout.rows.every((row) => row.baseline > row.xHeight && row.top + settings.rowHeightMm <= originalLayout.height - settings.marginMm));
});

test("worksheet settings reject unsupported values and limit user text", () => {
  const settings = normalizeWorksheetSettings({
    model: "unknown-model",
    paper: "A3",
    marginMm: 100,
    rowHeightMm: 2,
    guides: "invented",
    text: "abcdefghijklmnopqrstuvwxyz",
    tracingRows: 99,
    blankRows: 0,
    repetitions: 4,
  }, ["demo-round"]);
  assert.equal(settings.model, "demo-round");
  assert.equal(settings.paper, "A4");
  assert.equal(settings.marginMm, 12);
  assert.equal(settings.rowHeightMm, 18);
  assert.equal(settings.guides, "baseline-xheight");
  assert.equal(settings.text.length, 24);
  assert.equal(settings.tracingRows, 2);
  assert.equal(settings.blankRows, 2);
  assert.equal(settings.repetitions, 1);
});


test("worksheet text limits preserve complete grapheme clusters", () => {
  const text = `${"a".repeat(23)}e\u0301x`;
  const settings = normalizeWorksheetSettings({ text }, []);
  const segments = [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(settings.text)];
  assert.equal(segments.length, 24);
  assert.equal(segments.at(-1).segment, "e\u0301");
});

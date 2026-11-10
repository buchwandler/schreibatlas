// SPDX-License-Identifier: Apache-2.0
import assert from "node:assert/strict";
import { copyFileSync, cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import test from "node:test";
import { parse, stringify } from "yaml";
import { validateDataset } from "../../tools/validate-data.mjs";
import { buildData } from "../../tools/build-data.mjs";

const projectRoot = fileURLToPath(new URL("../../", import.meta.url));
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "schreibatlas-evidence-"));
  for (const dir of ["schema", "data", "assets", "licenses"]) cpSync(join(projectRoot, dir), join(root, dir), { recursive: true });
  copyFileSync(join(projectRoot, "package.json"), join(root, "package.json"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}
const read = (root, path) => parse(readFileSync(join(root, path), "utf8"));
function write(root, path, value) {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), stringify(value));
}
const modelPath = "data/models/de-volksschrift/model.yaml";
const fontPath = "data/fonts/volksschrift.yaml";
const source = "src-volksschrift-author";
function connection() {
  return { model: "de-volksschrift", left: "r", right: "e", status: "source-backed", behavior: { joins: true, left_variant: null, right_variant: null }, reference: { font: "font-volksschrift", shaped_text: "re" }, sources: [source], license: "CC-BY-SA-4.0" };
}
function expectError(root, fragment) {
  const { errors } = validateDataset({ root });
  assert.ok(errors.some((error) => error.includes(fragment)), errors.join("\n"));
}

test("rich model and source metadata validate without changing legacy records", (t) => {
  const root = fixture(t);
  const model = read(root, modelPath);
  Object.assign(model, {
    aliases: { de: ["Testname"], en: ["Test alias"] }, regions: ["DE-BY"], family: "historical",
    education: { level: ["primary"], role: ["initial-script"], notes: { en: "Fixture only." } },
    characteristics: { uppercase: { en: "Fixture only." } },
    examples: { words: [{ text: "re", language: "de", sources: [source] }] },
    repertoire: { teaching_core: { entries: ["U+0061-U+007A"], complete: true, sources: [source] } },
  });
  write(root, modelPath, model);
  const sourcePath = "data/sources/src-evidence-fixture.yaml";
  write(root, sourcePath, { id: "src-evidence-fixture", kind: "official-guidance", title: "Fixture only", author: [], publisher: null, year: null, locator: { pages: [1], figure: "Alphabet", section: "Scope", table: null, anchor: "alphabet" }, url: null, retrieved: "2026-01-01", edition: "1", isbn: null, doi: null, archive_url: null, rights: { type: "citation-only", license: null }, notes: null });
  assert.deepEqual(validateDataset({ root }).errors, []);
  model.regions = ["FR-75"];
  write(root, modelPath, model);
  expectError(root, "does not belong");
});

test("scoped repertoires require declared coverage and actual evidence", (t) => {
  const root = fixture(t);
  const model = read(root, modelPath);
  model.repertoire = { numerals: { entries: ["U+1F600"], complete: true, sources: ["src-demo-placeholder"] } };
  write(root, modelPath, model);
  expectError(root, "scoped repertoire entry is absent");
  expectError(root, "nested evidence cannot cite placeholder");
  model.repertoire.numerals.entries = ["U+007A-U+0061"];
  write(root, modelPath, model);
  expectError(root, "reversed repertoire range");
});

test("font correspondence is bidirectional and integrity detects modified bytes", (t) => {
  const root = fixture(t);
  const font = read(root, fontPath);
  const bytes = readFileSync(join(root, font.files[0]));
  Object.assign(font, { font_version: "Version 1.000; ttfautohint (v1.3)", upstream: { repository: "https://example.org/font", release: "fixture", commit: "a".repeat(40), source_file: "fixture.ttf" }, integrity: { sha256: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.length } });
  write(root, fontPath, font);
  assert.deepEqual(validateDataset({ root }).errors, []);
  font.integrity.sha256 = "0".repeat(64);
  font.integrity.bytes += 1;
  write(root, fontPath, font);
  expectError(root, "SHA-256 mismatch");
  expectError(root, "byte count mismatch");
  const model = read(root, modelPath);
  model.reference_fonts = [];
  write(root, modelPath, model);
  expectError(root, "must reference font");
});

test("font-derived glyph evidence cannot imply movement and structured variants need real sources", (t) => {
  const root = fixture(t);
  const glyphPath = "data/glyphs/de-volksschrift/0061.yaml";
  const glyph = read(root, glyphPath);
  glyph.derivation = { kind: "font-derived", source_font: "font-volksschrift", source_glyph: "a", process: "direct-font-render", verification: "source-backed", represents: ["visual-reference"], does_not_establish: ["official-stroke-order"] };
  glyph.variants = [{ id: "alternate-a", label: { en: "Fixture variant" }, status: "draft", sources: [source] }];
  glyph.source_claims = [{ field: "outline", sources: [source], notes: { en: "Fixture evidence only." } }];
  write(root, glyphPath, glyph);
  assert.deepEqual(validateDataset({ root }).errors, []);
  glyph.derivation.does_not_establish = [];
  glyph.variants[0].sources = ["src-missing"];
  write(root, glyphPath, glyph);
  expectError(root, "must exclude official-stroke-order");
  expectError(root, 'unresolved source reference "src-missing"');
});

test("connection records load and export without invented glyph records", (t) => {
  const root = fixture(t);
  write(root, "data/connections/de-volksschrift/r-e.yaml", connection());
  assert.deepEqual(validateDataset({ root }).errors, []);
  const output = join(root, "exports");
  const result = buildData({ root, outputDir: output });
  assert.equal(result.index.connections, "/data/v1/connections.json");
  assert.deepEqual(JSON.parse(readFileSync(join(output, "connections.json"), "utf8")), [connection()]);
});

test("connection records reject invalid sequences, fonts and variant claims", (t) => {
  const root = fixture(t);
  const pair = connection();
  pair.reference.shaped_text = "er";
  pair.reference.font = "font-langula-kurrent";
  pair.behavior.left_variant = "missing-variant";
  write(root, "data/connections/de-volksschrift/r-e.yaml", pair);
  expectError(root, "shaped_text must match");
  expectError(root, "connection font must be a reference font");
  expectError(root, "unresolved left variant");
  write(root, "data/connections/de-volksschrift/duplicate.yaml", pair);
  expectError(root, "duplicate connection pair");
});

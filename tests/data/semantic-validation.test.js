import assert from "node:assert/strict";
import { copyFileSync, cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { parse, stringify } from "yaml";
import test from "node:test";
import { validateDataset } from "../../tools/validate-data.mjs";

import { draftGlyphRecord } from "./content.test-helper.mjs";
const projectRoot = fileURLToPath(new URL("../../", import.meta.url));
const demoModelPath = "data/models/demo-round/model.yaml";

function fixtureRoot(t) {
  const root = mkdtempSync(join(tmpdir(), "schreibatlas-data-"));
  cpSync(join(projectRoot, "schema"), join(root, "schema"), { recursive: true });
  cpSync(join(projectRoot, "data"), join(root, "data"), { recursive: true });
  copyFileSync(join(projectRoot, "package.json"), join(root, "package.json"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}

function readYaml(root, path) {
  return parse(readFileSync(join(root, path), "utf8"));
}

function writeYaml(root, path, value) {
  const fullPath = join(root, path);
  mkdirSync(dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, stringify(value));
}

function assertDiagnostic(root, expected) {
  const { errors } = validateDataset({ root });
  assert.ok(errors.some((error) => error.includes(expected)), errors.join("\n"));
}

function addStrokeFixture(root, { order = 1, svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><path d="M 0 0 L 1 1"/></svg>' } = {}) {
  const model = readYaml(root, demoModelPath);
  model.character_repertoire = ["U+0061"];
  writeYaml(root, demoModelPath, model);
  writeYaml(root, "data/glyphs/demo-round/0061.yaml", draftGlyphRecord({ model: "demo-round", character: "a", unicode: ["U+0061"] }));
  writeYaml(root, "data/strokes/demo-round/0061.yaml", {
    model: "demo-round",
    character: "a",
    verification: "draft",
    strokes: [{ order, file: "assets/strokes/demo-round/0061-01.svg", pen_down: true, start: [0, 0], end: [1, 1] }],
    sources: ["src-demo-placeholder"],
    license: "CC-BY-SA-4.0",
  });
  const assetPath = join(root, "assets/strokes/demo-round/0061-01.svg");
  mkdirSync(dirname(assetPath), { recursive: true });
  writeFileSync(assetPath, svg);
}

function glyphRecord(overrides = {}) {
  return {
    model: "demo-round",
    character: "a",
    unicode: ["U+0061"],
    forms: { isolated: { status: "draft" }, contextual: [] },
    metrics: { baseline: null, x_height: null, ascender: null, descender: null },
    reference: { font: null, glyph_name: null },
    connections: { entry: { present: null }, exit: { present: null } },
    variants: [],
    sources: [],
    verification: "draft",
    license: "CC-BY-SA-4.0",
    ...overrides,
  };
}

test("the canonical data set passes semantic validation", () => {
  assert.deepEqual(validateDataset().errors, []);
});

test("invalid YAML is reported with its file path", (t) => {
  const root = fixtureRoot(t);
  writeFileSync(join(root, demoModelPath), "id: [invalid\n");
  assertDiagnostic(root, "invalid YAML");
});

test("duplicate model IDs are rejected", (t) => {
  const root = fixtureRoot(t);
  writeYaml(root, "data/models/demo-copy/model.yaml", readYaml(root, demoModelPath));
  assertDiagnostic(root, "duplicate model id \"demo-round\"");
});


test("schema-invalid fields are reported without crashing semantic checks", (t) => {
  const root = fixtureRoot(t);
  const model = readYaml(root, demoModelPath);
  model.languages = 5;
  writeYaml(root, demoModelPath, model);
  assertDiagnostic(root, "must be array");
});

test("unresolved source references are rejected", (t) => {
  const root = fixtureRoot(t);
  const model = readYaml(root, demoModelPath);
  model.sources = ["src-missing"];
  writeYaml(root, demoModelPath, model);
  assertDiagnostic(root, "unresolved source reference \"src-missing\"");
});

test("unresolved font references are rejected", (t) => {
  const root = fixtureRoot(t);
  const model = readYaml(root, demoModelPath);
  model.reference_fonts = ["font-missing"];
  writeYaml(root, demoModelPath, model);
  assertDiagnostic(root, "unresolved font reference \"font-missing\"");
});


test("invalid verification states are rejected by the schema", (t) => {
  const root = fixtureRoot(t);
  const model = readYaml(root, demoModelPath);
  model.status.verification = "pending";
  writeYaml(root, demoModelPath, model);
  assertDiagnostic(root, "must be equal to one of the allowed values");
});

test("glyph records must reference an existing model", (t) => {
  const root = fixtureRoot(t);
  writeYaml(root, "data/glyphs/missing-model/0061.yaml", glyphRecord({ model: "missing-model" }));
  assertDiagnostic(root, "unresolved model reference \"missing-model\"");
});

test("glyph records must be declared in their model repertoire", (t) => {
  const root = fixtureRoot(t);
  writeYaml(root, "data/glyphs/demo-round/0061.yaml", glyphRecord());
  assertDiagnostic(root, "U+0061 is not declared in model \"demo-round\" character_repertoire");
});

test("complete repertoires must have a glyph record for every character", (t) => {
  const root = fixtureRoot(t);
  const model = readYaml(root, demoModelPath);
  model.character_repertoire = ["U+0061"];
  model.character_repertoire_complete = true;
  writeYaml(root, demoModelPath, model);
  assertDiagnostic(root, "complete repertoire is missing glyph data for U+0061");
});

test("glyph Unicode values must match their character", (t) => {
  const root = fixtureRoot(t);
  writeYaml(root, "data/glyphs/demo-round/0061.yaml", glyphRecord({ unicode: ["U+0062"] }));
  assertDiagnostic(root, "unicode entries do not match the character value");
});

test("vector outlines require a baseline below their x-height", (t) => {
  const root = fixtureRoot(t);
  writeYaml(root, "data/glyphs/demo-round/0061.yaml", glyphRecord({
    sources: ["src-demo-placeholder"],
    outline: { path: "M 0 100 L 50 0 Z", view_box: [0, 0, 50, 100], baseline: 50, x_height: 50 },
  }));
  assertDiagnostic(root, "outline baseline must be below its x-height");
});

test("invalid SPDX license identifiers are rejected", (t) => {
  const root = fixtureRoot(t);
  const model = readYaml(root, demoModelPath);
  model.license = "Not-A-Real-License";
  writeYaml(root, demoModelPath, model);
  assertDiagnostic(root, "not a recognized SPDX license identifier");
});

test("missing font assets are rejected", (t) => {
  const root = fixtureRoot(t);
  const model = readYaml(root, demoModelPath);
  model.reference_fonts = ["font-fixture"];
  writeYaml(root, demoModelPath, model);
  writeYaml(root, "data/fonts/font-fixture.yaml", {
    id: "font-fixture",
    name: "Schema fixture",
    author: "Fixture author",
    project_url: null,
    license: "OFL-1.1",
    files: ["assets/fonts/missing.woff2"],
    correspondence: { model: "demo-round", degree: "unknown", notes: null },
    sources: [],
  });
  assertDiagnostic(root, "referenced asset does not exist: \"assets/fonts/missing.woff2\"");
});


test("missing stroke files are rejected", (t) => {
  const root = fixtureRoot(t);
  writeYaml(root, "data/strokes/demo-round/0061.yaml", {
    model: "demo-round",
    character: "a",
    verification: "draft",
    strokes: [{ order: 1, file: "assets/strokes/demo-round/missing.svg", pen_down: true, start: [0, 0], end: [1, 1] }],
    sources: ["src-demo-placeholder"],
    license: "CC-BY-SA-4.0",
  });
  assertDiagnostic(root, "referenced asset does not exist: \"assets/strokes/demo-round/missing.svg\"");
});

test("malformed SVG stroke assets are rejected", (t) => {
  const root = fixtureRoot(t);
  writeYaml(root, "data/strokes/demo-round/0061.yaml", {
    model: "demo-round",
    character: "a",
    verification: "draft",
    strokes: [{ order: 1, file: "assets/strokes/demo-round/0061-01.svg", pen_down: true, start: [0, 0], end: [1, 1] }],
    sources: ["src-demo-placeholder"],
    license: "CC-BY-SA-4.0",
  });
  const svgPath = join(root, "assets/strokes/demo-round/0061-01.svg");
  mkdirSync(join(svgPath, ".."), { recursive: true });
  writeFileSync(svgPath, "<svg><path></svg>");
  assertDiagnostic(root, "malformed SVG");
});

test("duplicate canonical glyph routes are rejected", (t) => {
  const root = fixtureRoot(t);
  writeYaml(root, "data/glyphs/demo-round/0061.yaml", glyphRecord());
  writeYaml(root, "data/glyphs/demo-round/0061-copy.yaml", glyphRecord());
  assertDiagnostic(root, "duplicate canonical glyph route \"demo-round/u0061\"");
});


test("sourced stroke records require matching glyphs and contiguous stroke order", (t) => {
  const root = fixtureRoot(t);
  addStrokeFixture(root);
  assert.deepEqual(validateDataset({ root }).errors, []);

  addStrokeFixture(root, { order: 2 });
  assertDiagnostic(root, "stroke order values must be unique and contiguous from 1");
});

test("stroke SVG assets reject active elements and non-normalized geometry", (t) => {
  const root = fixtureRoot(t);
  addStrokeFixture(root, { svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2 2"><script>alert(1)</script></svg>' });
  assertDiagnostic(root, "may contain only SVG path elements");
  assertDiagnostic(root, 'must use normalized viewBox="0 0 1 1"');
});

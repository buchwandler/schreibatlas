// SPDX-License-Identifier: Apache-2.0
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import { parse } from "yaml";
import test from "node:test";

const root = fileURLToPath(new URL("../../", import.meta.url));
const readJson = (path) => JSON.parse(readFileSync(join(root, path), "utf8"));
const readYaml = (path) => parse(readFileSync(join(root, path), "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: false });
const schemaNames = ["country", "language", "model", "glyph", "source", "font", "stroke"];

ajv.addSchema(readJson("schema/common.schema.json"));
for (const name of schemaNames) ajv.addSchema(readJson(`schema/${name}.schema.json`));

function assertValid(schemaName, record) {
  const validate = ajv.getSchema(`https://schreibatlas.de/schema/v1/${schemaName}.schema.json`);
  assert.ok(validate, `Missing ${schemaName} schema`);
  assert.equal(validate(record), true, JSON.stringify(validate.errors, null, 2));
}

const modelFiles = readdirSync(join(root, "data/models"), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => `data/models/${entry.name}/model.yaml`);

for (const [schemaName, paths] of [
  ["country", ["data/countries/DE.yaml"]],
  ["language", ["data/languages/de.yaml"]],
  ["source", ["data/sources/demo-placeholder.yaml"]],
  ["model", modelFiles],
]) {
  for (const path of paths) {
    test(`${schemaName} record ${path} matches its schema`, () => assertValid(schemaName, readYaml(path)));
  }
}

test("glyph schema accepts only explicitly recorded contextual outlines", () => {
  assertValid("glyph", {
    model: "demo-round",
    character: "a",
    unicode: ["U+0061"],
    forms: { isolated: { status: "draft" }, contextual: [{ context: "before e", status: "draft", outline: { path: "M 0 100 L 50 0 Z", view_box: [0, 0, 50, 100], baseline: 100, x_height: 50 } }] },
    metrics: { baseline: null, x_height: null, ascender: null, descender: null },
    outline: null,
    reference: { font: null, glyph_name: null },
    connections: { entry: { present: null }, exit: { present: null } },
    variants: [],
    sources: ["src-demo-placeholder"],
    verification: "draft",
    license: "CC-BY-SA-4.0",
  });
});

test("glyph schema accepts an explicit draft record without claiming verified form data", () => {
  assertValid("glyph", {
    model: "demo-round",
    character: "a",
    unicode: ["U+0061"],
    forms: { isolated: { status: "draft" }, contextual: [] },
    metrics: { baseline: null, x_height: null, ascender: null, descender: null },
    outline: { path: "M 0 100 L 50 0 Z", view_box: [0, 0, 50, 100], baseline: 100, x_height: 50 },
    reference: { font: null, glyph_name: null },
    connections: { entry: { present: null }, exit: { present: null } },
    variants: [],
    sources: ["src-demo-placeholder"],
    verification: "draft",
    license: "CC-BY-SA-4.0",
  });
});

test("font schema captures original license and correspondence limits", () => {
  assertValid("font", {
    id: "font-fixture",
    name: "Schema fixture only",
    author: "Fixture author",
    project_url: null,
    license: "OFL-1.1",
    files: [],
    correspondence: { model: null, degree: "unknown", notes: null },
    sources: [],
  });
});

test("font x-height calibration requires a mapped model and source", () => {
  const record = {
    id: "font-calibrated-fixture",
    name: "Calibration fixture only",
    author: "Fixture author",
    project_url: null,
    license: "OFL-1.1",
    files: [],
    correspondence: { model: "demo-round", degree: "partial", notes: "Test fixture." },
    calibration: { x_height_em: 0.5, x_height_method: "Lowercase x bounding box." },
    sources: ["src-demo-placeholder"],
  };
  assertValid("font", record);
  const invalid = { ...record, correspondence: { ...record.correspondence, model: null }, sources: [] };
  const validate = ajv.getSchema("https://schreibatlas.de/schema/v1/font.schema.json");
  assert.equal(validate(invalid), false);
  assert.equal(validate({ ...record, calibration: { ...record.calibration, x_height_method: "" } }), false);
});

test("stroke schema requires normalized paths and provenance", () => {
  assertValid("stroke", {
    model: "demo-round",
    character: "a",
    verification: "draft",
    strokes: [{ order: 1, file: "assets/strokes/demo-round/0061-01.svg", pen_down: true, start: [0, 0], end: [1, 1] }],
    sources: ["src-demo-placeholder"],
    license: "CC-BY-SA-4.0",
  });
});

test("demo models cannot pass the schema as verified", () => {
  const record = readYaml("data/models/demo-round/model.yaml");
  record.status.verification = "verified";
  const validate = ajv.getSchema("https://schreibatlas.de/schema/v1/model.schema.json");
  assert.equal(validate(record), false);
});

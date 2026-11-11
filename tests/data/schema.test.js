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
const schemaNames = ["country", "language", "model", "glyph", "source", "font", "stroke", "connection"];

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

test("font schema keeps archive identity separate from generated font metadata", () => {
  const record = {
    id: "font-generated-fixture",
    name: "Generated font fixture",
    author: "Fixture author",
    project_url: "https://ctan.org/pkg/schulschriften",
    license: "LPPL-1.3c",
    files: ["assets/fonts/generated.ttf"],
    license_file: "licenses/LPPL-1.3c-Schulschriften.txt",
    font_version: "Version 1.0",
    family_name: "Fixture family",
    postscript_name: "Fixture-Regular",
    format: "truetype",
    weight: 400,
    style: "normal",
    upstream: {
      kind: "archive",
      project_url: "https://ctan.org/pkg/schulschriften",
      archive_url: "https://mirrors.ctan.org/fonts/schulschriften.zip",
      package: "schulschriften",
      version: "5",
      retrieved: "2026-11-10",
      sha256: "b".repeat(64),
      source_file: "source/wela/wela14.mf",
    },
    derivation: {
      kind: "generated",
      source_format: "metafont",
      output_format: "truetype",
      recipe: "tools/fonts/schulschriften/build.py",
      toolchain: { metafont: "Metafont 2.71828182" },
      unicode_mapping: "tools/fonts/schulschriften/mappings/wela.json",
      unicode_mapping_sha256: "c".repeat(64),
      connection_mapping: null,
      tfm_file: "tools/fonts/schulschriften/generated/wela14.tfm",
      tfm_sha256: "d".repeat(64),
      provenance_file: "tools/fonts/schulschriften/generated/la-prototype.provenance.json",
      pipeline: ["METAFONT to TrueType"],
      notes: "A browser-compatible derivative, not an official upstream TTF.",
    },
    integrity: { sha256: "a".repeat(64), bytes: 1024 },
    shaping: { required_features: ["calt", "kern"], language_tag: "de", direction: "ltr" },
    calibration: { x_height_em: 0.34, x_height_method: "TrueType cmap U+0078" },
    correspondence: { model: "demo-round", degree: "partial", notes: "Fixture.", sources: ["src-demo-placeholder"] },
    sources: ["src-demo-placeholder"],
  };
  assertValid("font", record);
  const validate = ajv.getSchema("https://schreibatlas.de/schema/v1/font.schema.json");
  assert.equal(validate({ ...record, format: "woff2" }), false);
  assert.equal(validate({ ...record, derivation: undefined }), false);
  assert.equal(validate({ ...record, upstream: { ...record.upstream, sha256: "not-a-hash" } }), false);
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

// SPDX-License-Identifier: Apache-2.0
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { buildData, validateGeneratedUrls } from "../../tools/build-data.mjs";
import { inspectTrueType } from "../../tools/font-metadata.mjs";
import { draftGlyphRecord } from "./content.test-helper.mjs";
import { fileURLToPath } from "node:url";
import { parse, stringify } from "yaml";

const projectRoot = fileURLToPath(new URL("../../", import.meta.url));
test("versioned JSON exports are deterministic and respect the deployment base path", (t) => {
  const temporary = mkdtempSync(join(tmpdir(), "schreibatlas-build-data-"));
  t.after(() => rmSync(temporary, { recursive: true, force: true }));
  const firstOutput = join(temporary, "first");
  const secondOutput = join(temporary, "second");
  const first = buildData({ outputDir: firstOutput, basePath: "/schreibatlas" });
  const second = buildData({ outputDir: secondOutput, basePath: "/schreibatlas" });

  assert.deepEqual(first.files, second.files);
  for (const path of first.files) {
    assert.equal(readFileSync(join(firstOutput, path), "utf8"), readFileSync(join(secondOutput, path), "utf8"));
  }

  const index = JSON.parse(readFileSync(join(firstOutput, "index.json"), "utf8"));
  assert.equal(index.schemaVersion, 1);
  assert.equal(index.datasetVersion, "0.1.0");
  assert.equal(index.models, "/schreibatlas/data/v1/models.json");
  assert.equal(index.countries, "/schreibatlas/data/v1/countries.json");
  assert.equal(index.languages, "/schreibatlas/data/v1/languages.json");
  assert.equal(index.sources, "/schreibatlas/data/v1/sources.json");
  assert.equal(index.fonts, "/schreibatlas/data/v1/fonts.json");
  assert.equal(index.glyphs, "/schreibatlas/data/v1/glyphs.json");
  assert.equal(index.strokes, "/schreibatlas/data/v1/strokes.json");
  assert.ok(existsSync(join(firstOutput, "models/demo-round.json")));
  assert.ok(first.files.includes("countries.json"));
  assert.ok(first.files.includes("languages.json"));
  const countries = JSON.parse(readFileSync(join(firstOutput, "countries.json"), "utf8"));
  const languages = JSON.parse(readFileSync(join(firstOutput, "languages.json"), "utf8"));
  assert.deepEqual(countries.map(({ id }) => id), ["DE"]);
  assert.deepEqual(languages.map(({ id }) => id), ["de"]);

  const modelIndex = JSON.parse(readFileSync(join(firstOutput, "models.json"), "utf8"));
  assert.equal(modelIndex.find((model) => model.id === "demo-round").url, "/schreibatlas/data/v1/models/demo-round.json");
});

test("glyph exports use Unicode code-point route slugs", (t) => {
  const temporary = mkdtempSync(join(tmpdir(), "schreibatlas-glyph-export-"));
  t.after(() => rmSync(temporary, { recursive: true, force: true }));
  const root = join(temporary, "project");
  cpSync(join(projectRoot, "schema"), join(root, "schema"), { recursive: true });
  cpSync(join(projectRoot, "data"), join(root, "data"), { recursive: true });
  cpSync(join(projectRoot, "assets"), join(root, "assets"), { recursive: true });
  cpSync(join(projectRoot, "licenses"), join(root, "licenses"), { recursive: true });
  cpSync(join(projectRoot, "tools/fonts/schulschriften"), join(root, "tools/fonts/schulschriften"), { recursive: true });
  cpSync(join(projectRoot, "vendor/ctan/schulschriften"), join(root, "vendor/ctan/schulschriften"), { recursive: true });
  copyFileSync(join(projectRoot, "package.json"), join(root, "package.json"));

  const modelPath = join(root, "data/models/demo-round/model.yaml");
  const model = parse(readFileSync(modelPath, "utf8"));
  model.character_repertoire = ["U+00DF"];
  writeFileSync(modelPath, stringify(model));
  const glyphPath = join(root, "data/glyphs/demo-round/00DF.yaml");
  mkdirSync(join(root, "data/glyphs/demo-round"), { recursive: true });
  writeFileSync(glyphPath, stringify({
    model: "demo-round",
    character: "ß",
    unicode: ["U+00DF"],
    forms: { isolated: { status: "draft" }, contextual: [] },
    metrics: { baseline: null, x_height: null, ascender: null, descender: null },
    reference: { font: null, glyph_name: null },
    connections: { entry: { present: null }, exit: { present: null } },
    variants: [],
    sources: [],
    verification: "draft",
    license: "CC-BY-SA-4.0",
  }));

  const output = join(temporary, "output");
  const result = buildData({ root, outputDir: output });
  assert.ok(result.files.includes("glyphs/demo-round/u00df.json"));
  assert.equal(JSON.parse(readFileSync(join(output, "glyphs/demo-round/u00df.json"), "utf8")).character, "ß");
  const glyphIndex = JSON.parse(readFileSync(join(output, "glyphs.json"), "utf8"));
  assert.deepEqual(glyphIndex.filter(({ model }) => model === "demo-round"), [{
    model: "demo-round",
    character: "ß",
    unicode: ["U+00DF"],
    slug: "u00df",
    verification: "draft",
    url: "/data/v1/glyphs/demo-round/u00df.json",
  }]);
});

test("font assets are copied into their local versioned API endpoint", (t) => {
  const temporary = mkdtempSync(join(tmpdir(), "schreibatlas-font-export-"));
  t.after(() => rmSync(temporary, { recursive: true, force: true }));
  const root = join(temporary, "project");
  cpSync(join(projectRoot, "schema"), join(root, "schema"), { recursive: true });
  cpSync(join(projectRoot, "data"), join(root, "data"), { recursive: true });
  cpSync(join(projectRoot, "assets"), join(root, "assets"), { recursive: true });
  cpSync(join(projectRoot, "licenses"), join(root, "licenses"), { recursive: true });
  cpSync(join(projectRoot, "tools/fonts/schulschriften"), join(root, "tools/fonts/schulschriften"), { recursive: true });
  cpSync(join(projectRoot, "vendor/ctan/schulschriften"), join(root, "vendor/ctan/schulschriften"), { recursive: true });
  copyFileSync(join(projectRoot, "package.json"), join(root, "package.json"));
  const modelPath = join(root, "data/models/demo-round/model.yaml");
  const model = parse(readFileSync(modelPath, "utf8"));
  model.reference_fonts = ["font-fixture"];
  writeFileSync(modelPath, stringify(model));
  const assetPath = join(root, "assets/fonts/reference.woff2");
  mkdirSync(join(root, "assets/fonts"), { recursive: true });
  const asset = Buffer.from("font-fixture-data");
  writeFileSync(assetPath, asset);
  const fontPath = join(root, "data/fonts/font-fixture.yaml");
  mkdirSync(join(root, "data/fonts"), { recursive: true });
  writeFileSync(fontPath, stringify({
    id: "font-fixture",
    name: "Font export fixture",
    author: "Fixture author",
    project_url: null,
    license: "OFL-1.1",
    files: ["assets/fonts/reference.woff2"],
    correspondence: { model: "demo-round", degree: "visual-only", notes: "Test fixture only." },
    sources: [],
  }));

  const output = join(temporary, "output");
  const result = buildData({ root, outputDir: output, basePath: "/schreibatlas" });
  const fonts = JSON.parse(readFileSync(join(output, "fonts.json"), "utf8"));
  assert.equal(fonts[0].file_urls[0], "/schreibatlas/data/v1/assets/fonts/font-fixture/1-reference.woff2");
  assert.deepEqual(readFileSync(join(output, "assets/fonts/font-fixture/1-reference.woff2")), asset);
  assert.ok(result.files.includes("assets/fonts/font-fixture/1-reference.woff2"));
  const volksschrift = fonts.find(({ id }) => id === "font-volksschrift");
  const licenseUrl = "/schreibatlas/data/v1/assets/fonts/font-volksschrift/OFL-1.1-Volksschrift.txt";
  assert.ok(volksschrift.supported_characters.includes("b"));
  assert.equal(volksschrift.supported_characters.includes("😀"), false);
  assert.equal(volksschrift.license_file_url, licenseUrl);
  assert.equal(readFileSync(join(output, "assets/fonts/font-volksschrift/OFL-1.1-Volksschrift.txt"), "utf8"), readFileSync(join(root, "licenses/OFL-1.1-Volksschrift.txt"), "utf8"));
  assert.ok(result.files.includes("assets/fonts/font-volksschrift/OFL-1.1-Volksschrift.txt"));
});

test("generated font exports include pinned archive and derivation provenance", (t) => {
  const temporary = mkdtempSync(join(tmpdir(), "schreibatlas-font-provenance-export-"));
  t.after(() => rmSync(temporary, { recursive: true, force: true }));
  const root = join(temporary, "project");
  cpSync(join(projectRoot, "schema"), join(root, "schema"), { recursive: true });
  cpSync(join(projectRoot, "data"), join(root, "data"), { recursive: true });
  cpSync(join(projectRoot, "assets"), join(root, "assets"), { recursive: true });
  cpSync(join(projectRoot, "licenses"), join(root, "licenses"), { recursive: true });
  cpSync(join(projectRoot, "vendor/ctan/schulschriften"), join(root, "vendor/ctan/schulschriften"), { recursive: true });
  cpSync(join(projectRoot, "tools/fonts/schulschriften"), join(root, "tools/fonts/schulschriften"), { recursive: true });
  copyFileSync(join(projectRoot, "package.json"), join(root, "package.json"));

  const profileRoot = join(root, "tools/fonts/schulschriften");
  const fontBytes = readFileSync(join(profileRoot, "generated/la-prototype.ttf"));
  const metadata = inspectTrueType(fontBytes);
  const provenancePath = "tools/fonts/schulschriften/generated/la-prototype.provenance.json";
  const provenance = JSON.parse(readFileSync(join(root, provenancePath), "utf8"));
  const fontAsset = join(root, "assets/fonts/generated.ttf");
  mkdirSync(join(root, "assets/fonts"), { recursive: true });
  writeFileSync(fontAsset, fontBytes);

  const modelPath = join(root, "data/models/demo-round/model.yaml");
  const model = parse(readFileSync(modelPath, "utf8"));
  model.character_repertoire = ["U+0061"];
  model.reference_fonts = ["font-generated-fixture"];
  writeFileSync(modelPath, stringify(model));

  const fontPath = join(root, "data/fonts/font-generated-fixture.yaml");
  writeFileSync(fontPath, stringify({
    id: "font-generated-fixture",
    name: "Schreibatlas Schulschriften LA",
    author: "Walter Entenmann; browser derivative generated by Schreibatlas",
    project_url: "https://ctan.org/pkg/schulschriften",
    license: "LPPL-1.3c",
    files: ["assets/fonts/generated.ttf"],
    license_file: "licenses/LPPL-1.3c-Schulschriften.txt",
    font_version: metadata.version,
    family_name: metadata.family,
    postscript_name: metadata.postscriptName,
    format: "truetype",
    weight: metadata.weight,
    style: "normal",
    upstream: {
      kind: "archive",
      project_url: "https://ctan.org/pkg/schulschriften",
      archive_url: "https://mirrors.ctan.org/fonts/schulschriften.zip",
      package: provenance.upstream.package,
      version: String(provenance.upstream.version),
      retrieved: "2026-11-10",
      sha256: provenance.upstream.archive_sha256,
      source_file: "source/wela/wela14.mf",
    },
    derivation: {
      kind: "generated",
      source_format: "metafont",
      output_format: "truetype",
      recipe: provenance.derivation.recipe,
      toolchain: provenance.derivation.tool_versions,
      unicode_mapping: provenance.derivation.unicode_mapping,
      unicode_mapping_sha256: provenance.profile.mapping_sha256,
      connection_mapping: null,
      tfm_file: provenance.derivation.tfm_path,
      tfm_sha256: provenance.derivation.tfm_sha256,
      provenance_file: provenancePath,
      pipeline: provenance.derivation.pipeline,
      notes: "A browser-compatible derivative generated by Schreibatlas, not an official upstream TTF.",
    },
    integrity: { sha256: createHash("sha256").update(fontBytes).digest("hex"), bytes: fontBytes.length },
    shaping: { required_features: metadata.features, language_tag: "de", direction: "ltr" },
    calibration: {
      x_height_em: metadata.xHeightEm,
      x_height_method: "TrueType cmap U+0078 -> glyf.yMax / head.unitsPerEm.",
      ascender_em: metadata.ascenderEm,
      descender_em: metadata.descenderEm,
    },
    correspondence: {
      model: "demo-round",
      degree: "partial",
      scope: ["visual-letterforms", "contextual-shaping"],
      excludes: ["authoritative-stroke-order", "official-teaching-sequence", "exact-source-trace"],
      sources: ["src-ctan-schulschriften-v5"],
      notes: "Generated browser reference from the CTAN METAFONT implementation.",
    },
    sources: ["src-ctan-schulschriften-v5"],
  }));

  const output = join(temporary, "output");
  const result = buildData({ root, outputDir: output, basePath: "/schreibatlas" });
  const fonts = JSON.parse(readFileSync(join(output, "fonts.json"), "utf8"));
  const exported = fonts.find(({ id }) => id === "font-generated-fixture");
  assert.deepEqual(exported.supported_characters, metadata.supportedCharacters);
  assert.ok(exported.supported_characters.includes("ß"));
  assert.equal(exported.supported_characters.includes("😀"), false);
  assert.equal(exported.upstream.sha256, provenance.upstream.archive_sha256);
  assert.equal(exported.integrity.sha256, provenance.artifact.sha256);
  assert.equal(exported.derivation.unicode_mapping_sha256, provenance.profile.mapping_sha256);
  const provenanceUrl = "/schreibatlas/data/v1/assets/fonts/font-generated-fixture/provenance/la-prototype.provenance.json";
  assert.equal(exported.derivation.provenance_file_url, provenanceUrl);
  assert.deepEqual(JSON.parse(readFileSync(join(output, "assets/fonts/font-generated-fixture/provenance/la-prototype.provenance.json"), "utf8")), provenance);
  assert.ok(result.files.includes("assets/fonts/font-generated-fixture/provenance/la-prototype.provenance.json"));
  assert.notEqual(exported.upstream.sha256, exported.integrity.sha256);
  const changedFont = parse(readFileSync(fontPath, "utf8"));
  changedFont.upstream.sha256 = "0".repeat(64);
  writeFileSync(fontPath, stringify(changedFont));
  assert.throws(() => buildData({ root, outputDir: output, basePath: "/schreibatlas" }), /provenance archive SHA-256 mismatch/);
  changedFont.upstream.sha256 = provenance.upstream.archive_sha256;
  changedFont.integrity.sha256 = changedFont.upstream.sha256;
  writeFileSync(fontPath, stringify(changedFont));
  assert.throws(() => buildData({ root, outputDir: output, basePath: "/schreibatlas" }), /archive checksum and generated font integrity must remain distinct/);
});

test("generated API links must resolve to files under their versioned endpoint", () => {
  const temporary = mkdtempSync(join(tmpdir(), "schreibatlas-url-check-"));
  try {
    assert.throws(() => validateGeneratedUrls(["/schreibatlas/data/v1/missing.json"], {
      apiPrefix: "/schreibatlas/data/v1",
      targetDirectory: temporary,
      generatedFiles: new Set(),
    }), /does not resolve to an export/);
    assert.throws(() => validateGeneratedUrls(["/other/data/v1/models.json"], {
      apiPrefix: "/schreibatlas/data/v1",
      targetDirectory: temporary,
      generatedFiles: new Set(["models.json"]),
    }), /outside the versioned API/);
    assert.throws(() => validateGeneratedUrls(["/schreibatlas/data/v1/models.json"], {
      apiPrefix: "/schreibatlas/data/v1",
      targetDirectory: temporary,
      generatedFiles: new Set(["models.json"]),
    }), /target is missing/);
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
});


test("stroke records and normalized SVG assets are exported under local Unicode routes", (t) => {
  const temporary = mkdtempSync(join(tmpdir(), "schreibatlas-stroke-export-"));
  t.after(() => rmSync(temporary, { recursive: true, force: true }));
  const root = join(temporary, "project");
  cpSync(join(projectRoot, "schema"), join(root, "schema"), { recursive: true });
  cpSync(join(projectRoot, "data"), join(root, "data"), { recursive: true });
  cpSync(join(projectRoot, "assets"), join(root, "assets"), { recursive: true });
  cpSync(join(projectRoot, "licenses"), join(root, "licenses"), { recursive: true });
  cpSync(join(projectRoot, "tools/fonts/schulschriften"), join(root, "tools/fonts/schulschriften"), { recursive: true });
  cpSync(join(projectRoot, "vendor/ctan/schulschriften"), join(root, "vendor/ctan/schulschriften"), { recursive: true });
  copyFileSync(join(projectRoot, "package.json"), join(root, "package.json"));
  const modelPath = join(root, "data/models/demo-round/model.yaml");
  const model = parse(readFileSync(modelPath, "utf8"));
  model.character_repertoire = ["U+0061"];
  writeFileSync(modelPath, stringify(model));
  const glyphPath = join(root, "data/glyphs/demo-round/0061.yaml");
  mkdirSync(join(root, "data/glyphs/demo-round"), { recursive: true });
  writeFileSync(glyphPath, stringify(draftGlyphRecord({ model: "demo-round", character: "a", unicode: ["U+0061"] })));
  const strokePath = join(root, "data/strokes/demo-round/0061.yaml");
  mkdirSync(join(root, "data/strokes/demo-round"), { recursive: true });
  writeFileSync(strokePath, stringify({
    model: "demo-round",
    character: "a",
    verification: "draft",
    strokes: [{ order: 1, file: "assets/strokes/demo-round/0061-01.svg", pen_down: true, start: [0, 0], end: [1, 1] }],
    sources: ["src-demo-placeholder"],
    license: "CC-BY-SA-4.0",
  }));
  const sourceAsset = join(root, "assets/strokes/demo-round/0061-01.svg");
  mkdirSync(join(sourceAsset, ".."), { recursive: true });
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><path d="M 0 0 L 1 1"/></svg>';
  writeFileSync(sourceAsset, svg);

  const output = join(temporary, "output");
  const result = buildData({ root, outputDir: output, basePath: "/schreibatlas" });
  const index = JSON.parse(readFileSync(join(output, "strokes.json"), "utf8"));
  assert.equal(index[0].url, "/schreibatlas/data/v1/strokes/demo-round/u0061.json");
  const exported = JSON.parse(readFileSync(join(output, "strokes/demo-round/u0061.json"), "utf8"));
  assert.equal(exported.strokes[0].file_url, "/schreibatlas/data/v1/assets/strokes/demo-round/u0061-01.svg");
  const exportedSvg = readFileSync(join(output, "assets/strokes/demo-round/u0061-01.svg"), "utf8");
  assert.match(exportedSvg, /viewBox="0 0 1 1"/);
  assert.match(exportedSvg, /d="M 0 0 L 1 1"/);
  assert.match(exportedSvg, /stroke="#1d1d1b"/);
  assert.ok(result.files.includes("assets/strokes/demo-round/u0061-01.svg"));
});

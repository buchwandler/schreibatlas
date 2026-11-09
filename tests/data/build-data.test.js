import assert from "node:assert/strict";
import { copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { buildData, validateGeneratedUrls } from "../../tools/build-data.mjs";
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
  assert.equal(index.sources, "/schreibatlas/data/v1/sources.json");
  assert.equal(index.fonts, "/schreibatlas/data/v1/fonts.json");
  assert.equal(index.glyphs, "/schreibatlas/data/v1/glyphs.json");
  assert.equal(index.strokes, "/schreibatlas/data/v1/strokes.json");
  assert.ok(existsSync(join(firstOutput, "models/demo-round.json")));

  const modelIndex = JSON.parse(readFileSync(join(firstOutput, "models.json"), "utf8"));
  assert.equal(modelIndex.find((model) => model.id === "demo-round").url, "/schreibatlas/data/v1/models/demo-round.json");
});

test("glyph exports use Unicode code-point route slugs", (t) => {
  const temporary = mkdtempSync(join(tmpdir(), "schreibatlas-glyph-export-"));
  t.after(() => rmSync(temporary, { recursive: true, force: true }));
  const root = join(temporary, "project");
  cpSync(join(projectRoot, "schema"), join(root, "schema"), { recursive: true });
  cpSync(join(projectRoot, "data"), join(root, "data"), { recursive: true });
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
  assert.deepEqual(glyphIndex, [{
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

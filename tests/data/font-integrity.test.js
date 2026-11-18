// SPDX-License-Identifier: Apache-2.0
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { loadContent, repertoireCharacters } from "../../tools/content.mjs";
import { fontMetadataErrors, inspectSfnt } from "../../tools/font-metadata.mjs";

import { codePointLabelToCharacter, shapeReferenceWord } from "../../src/lib/reference-font-shaping.ts";
const root = fileURLToPath(new URL("../../", import.meta.url));
const content = loadContent(root);
const archiveSha256 = "b33215791baec691dda5b1bac5a57cc50fadc931dc43c09759d77c0c404e72fc";
const sourceProfiles = JSON.parse(readFileSync(resolve(root, "tools/fonts/schulschriften/profiles.json"), "utf8")).profiles;
const germanCore = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzÄÖÜäöüß0123456789.,?!";
const profiles = [
  { model: "de-la", font: "font-schulschriften-la", source: "wela", driver: "welasl14", shape: "sl" },
  { model: "de-sas", font: "font-schulschriften-sas", source: "wesa", driver: "wesasl14", shape: "sl" },
  { model: "de-va", font: "font-schulschriften-va", source: "weva", driver: "wevasl14", shape: "sl" },
  { model: "de-suetterlin", font: "font-schulschriften-suetterlin", source: "wesu", driver: "wesu14", shape: "n" },
  { model: "de-deutsche-normalschrift", font: "font-schulschriften-dn", source: "wedn", driver: "wednsl14", shape: "sl" },
];

test("reference font word boundaries wrap a single isolated character", () => {
  const font = { shaping: { word_boundary: { start: "U+00A7", end: "U+00B6" } } };
  assert.equal(codePointLabelToCharacter("U+00A7"), "§");
  assert.equal(shapeReferenceWord("A", font), "§A¶");
  assert.equal(shapeReferenceWord("A", { shaping: {} }), "A");
  assert.throws(() => shapeReferenceWord("§", font), /reserved/);
});
const fontById = new Map(content.fonts.map((font) => [font.id, font]));
const modelById = new Map(content.models.map((model) => [model.id, model]));

test("Schulschriften profiles select the documented standard METAFONT drivers", () => {
  assert.deepEqual(
    Object.fromEntries(sourceProfiles.map(({ id, source_driver }) => [id, source_driver])),
    {
      la: "welasl14",
      sas: "wesasl14",
      va: "wevasl14",
      suetterlin: "wesu14",
      "deutsche-normalschrift": "wednsl14",
    },
  );
  assert.deepEqual(
    Object.fromEntries(sourceProfiles.map(({ id, source_shape }) => [id, source_shape])),
    {
      la: "sl",
      sas: "sl",
      va: "sl",
      suetterlin: "n",
      "deutsche-normalschrift": "sl",
    },
  );
});

test("model slant metadata uses source-backed inclination from vertical", () => {
  for (const [modelId, nominalDegrees] of [
    ["de-sas", 14],
    ["de-la", 18],
    ["de-va", 11],
    ["de-deutsche-normalschrift", 14],
  ]) {
    assert.deepEqual(modelById.get(modelId).classification.slant, {
      kind: "right",
      nominal_degrees: nominalDegrees,
    });
  }
  assert.deepEqual(modelById.get("de-suetterlin").classification.slant, {
    kind: "vertical",
    nominal_degrees: 0,
  });
});

test("all five CTAN browser derivatives have distinct source-backed model references", () => {
  assert.deepEqual(content.fonts.filter((font) => font.id.startsWith("font-schulschriften-")).map((font) => font.id).sort(), profiles.map(({ font }) => font).sort());
  for (const { model: modelId, font: fontId } of profiles) {
    const model = modelById.get(modelId);
    const font = fontById.get(fontId);
    assert.deepEqual(model.reference_fonts, [fontId]);
    assert.equal(model.character_repertoire_complete, false);
    assert.equal(font.correspondence.model, modelId);
    assert.equal(font.correspondence.degree, "partial");
    assert.ok(font.correspondence.excludes.includes("authoritative-stroke-order"));
    assert.ok(font.sources.includes("src-ctan-schulschriften-v5"));
    assert.ok(font.sources.includes("src-schulschriften-manual-2014"));
  }
});

for (const { model: modelId, font: fontId, source, driver, shape } of profiles) {
  const font = fontById.get(fontId);
  test(`${font.name}: pinned source, derivation, identity, coverage and calibration`, () => {
    const bytes = readFileSync(resolve(root, font.files[0]));
    const metadata = inspectSfnt(bytes);
    const provenance = JSON.parse(readFileSync(resolve(root, font.derivation.provenance_file), "utf8"));
    const profileId = sourceProfiles.find(({ source_stem }) => source_stem === source).id;
    const parity = JSON.parse(readFileSync(resolve(root, `tools/fonts/schulschriften/reports/${profileId}-font-parity.json`), "utf8"));
    const mappingBytes = readFileSync(resolve(root, font.derivation.unicode_mapping));
    const mapping = JSON.parse(mappingBytes);
    const model = modelById.get(modelId);
    const tfmBytes = readFileSync(resolve(root, font.derivation.tfm_file));
    const license = readFileSync(resolve(root, font.license_file), "utf8");

    assert.equal(createHash("sha256").update(bytes).digest("hex"), font.integrity.sha256);
    assert.equal(bytes.length, font.integrity.bytes);
    assert.equal(font.upstream.package, "CTAN schulschriften");
    assert.equal(font.upstream.version, "5");
    assert.equal(font.upstream.sha256, archiveSha256);
    assert.equal(font.upstream.source_file, `source/${source}/${driver}.mf`);
    assert.equal(font.derivation.tfm_file, `tools/fonts/schulschriften/generated/${driver}.tfm`);
    assert.notEqual(font.upstream.sha256, font.integrity.sha256);
    assert.equal(font.derivation.kind, "generated");
    assert.equal(font.derivation.source_format, "metafont");
    assert.equal(font.derivation.output_format, "truetype");
    assert.equal(font.derivation.recipe, "tools/fonts/schulschriften/build.py");
    assert.equal(createHash("sha256").update(mappingBytes).digest("hex"), font.derivation.unicode_mapping_sha256);
    assert.equal(createHash("sha256").update(tfmBytes).digest("hex"), font.derivation.tfm_sha256);
    assert.equal(provenance.upstream.archive_sha256, font.upstream.sha256);
    assert.equal(provenance.artifact.sha256, font.integrity.sha256);
    assert.equal(provenance.profile.source_stem, source);
    assert.equal(provenance.profile.source_driver, driver);
    assert.equal(provenance.profile.source_shape, shape);
    assert.equal(provenance.derivation.tfm_path, font.derivation.tfm_file);
    assert.equal(parity.source_driver, driver);
    assert.equal(parity.source_shape, shape);
    assert.equal(parity.tfm, font.derivation.tfm_file);
    assert.equal(font.font_version, "Version 1.0");
    assert.equal(font.family_name, metadata.family);
    assert.equal(font.postscript_name, metadata.postscriptName);
    assert.equal(font.weight, 400);
    assert.equal(font.style, "normal");
    assert.equal(metadata.subfamily, "Regular");
    assert.equal(metadata.typographicSubfamily, "Regular");
    assert.equal(metadata.fsSelection & 0x40, 0x40);
    assert.equal(metadata.macStyle, 0);
    assert.equal(metadata.italicAngle, 0);
    assert.deepEqual(font.shaping.required_features, ["calt", "kern"]);
    assert.deepEqual(font.shaping.word_boundary, {
      start: mapping.word_boundary_markers.start.codepoint,
      end: mapping.word_boundary_markers.end.codepoint,
    });
    for (const control of Object.values(font.shaping.word_boundary)) {
      const character = String.fromCodePoint(Number.parseInt(control.slice(2), 16));
      assert.equal(metadata.hasCharacter(character), true);
      assert.equal(repertoireCharacters(model).includes(character), false);
    }
    assert.deepEqual(fontMetadataErrors(font, metadata), []);
    assert.ok(metadata.hasCharacter(germanCore));
    assert.equal(metadata.hasCharacter("😀"), false);
    assert.equal(metadata.features.includes("calt"), true);
    assert.equal(metadata.features.includes("kern"), true);
    assert.equal(metadata.xHeightEm, font.calibration.x_height_em);
    assert.equal(metadata.ascenderEm, font.calibration.ascender_em);
    assert.equal(metadata.descenderEm, font.calibration.descender_em);
    assert.match(license, /LPPL Version 1\.3c/);
    assert.ok(fontMetadataErrors({ ...font, font_version: "wrong", family_name: "wrong", postscript_name: "wrong", shaping: { required_features: ["xxxx"] } }, metadata).length >= 4);
    assert.equal(modelById.get(modelId).reference_fonts[0], font.id);
  });
}

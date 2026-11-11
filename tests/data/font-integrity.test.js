// SPDX-License-Identifier: Apache-2.0
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { loadContent } from "../../tools/content.mjs";
import { fontMetadataErrors, inspectTrueType } from "../../tools/font-metadata.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const content = loadContent(root);
const archiveSha256 = "b33215791baec691dda5b1bac5a57cc50fadc931dc43c09759d77c0c404e72fc";
const germanCore = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzÄÖÜäöüß0123456789.,?!";
const profiles = [
  { model: "de-la", font: "font-schulschriften-la", source: "wela" },
  { model: "de-sas", font: "font-schulschriften-sas", source: "wesa" },
  { model: "de-va", font: "font-schulschriften-va", source: "weva" },
  { model: "de-suetterlin", font: "font-schulschriften-suetterlin", source: "wesu" },
  { model: "de-deutsche-normalschrift", font: "font-schulschriften-dn", source: "wedn" },
];
const fontById = new Map(content.fonts.map((font) => [font.id, font]));
const modelById = new Map(content.models.map((model) => [model.id, model]));

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
  assert.deepEqual(modelById.get("de-grundschrift").reference_fonts, []);
});

for (const { model: modelId, font: fontId, source } of profiles) {
  const font = fontById.get(fontId);
  test(`${font.name}: pinned source, derivation, identity, coverage and calibration`, () => {
    const bytes = readFileSync(resolve(root, font.files[0]));
    const metadata = inspectTrueType(bytes);
    const provenance = JSON.parse(readFileSync(resolve(root, font.derivation.provenance_file), "utf8"));
    const mappingBytes = readFileSync(resolve(root, font.derivation.unicode_mapping));
    const tfmBytes = readFileSync(resolve(root, font.derivation.tfm_file));
    const license = readFileSync(resolve(root, font.license_file), "utf8");

    assert.equal(createHash("sha256").update(bytes).digest("hex"), font.integrity.sha256);
    assert.equal(bytes.length, font.integrity.bytes);
    assert.equal(font.upstream.package, "CTAN schulschriften");
    assert.equal(font.upstream.version, "5");
    assert.equal(font.upstream.sha256, archiveSha256);
    assert.equal(font.upstream.source_file, `source/${source}/${source}14.mf`);
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
    assert.equal(font.font_version, "Version 1.0");
    assert.equal(font.family_name, metadata.family);
    assert.equal(font.postscript_name, metadata.postscriptName);
    assert.equal(font.weight, 400);
    assert.equal(font.style, "normal");
    assert.deepEqual(font.shaping.required_features, ["calt", "kern"]);
    assert.deepEqual(fontMetadataErrors(font, bytes), []);
    assert.ok(metadata.hasCharacter(germanCore));
    assert.equal(metadata.hasCharacter("😀"), false);
    assert.equal(metadata.features.includes("calt"), true);
    assert.equal(metadata.features.includes("kern"), true);
    assert.equal(metadata.xHeightEm, font.calibration.x_height_em);
    assert.equal(metadata.ascenderEm, font.calibration.ascender_em);
    assert.equal(metadata.descenderEm, font.calibration.descender_em);
    assert.match(license, /LPPL Version 1\.3c/);
    assert.ok(fontMetadataErrors({ ...font, font_version: "wrong", family_name: "wrong", postscript_name: "wrong", shaping: { required_features: ["xxxx"] } }, bytes).length >= 4);
    assert.equal(modelById.get(modelId).reference_fonts[0], font.id);
  });
}

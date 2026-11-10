// SPDX-License-Identifier: Apache-2.0
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import test from "node:test";
import { loadContent } from "../../tools/content.mjs";
import { fontMetadataErrors, inspectTrueType } from "../../tools/font-metadata.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const content = loadContent(root);
const fonts = content.fonts.filter((font) => font.id.startsWith("font-playwrite-de-"));
const germanCore = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzÄÖÜäöüß";

test("the German reference set has four independently documented non-demo models", () => {
  assert.equal(fonts.length, 4);
  for (const font of fonts) {
    const model = content.models.find((model) => model.id === font.correspondence.model);
    assert.equal(model.demo, false);
    assert.equal(model.character_repertoire_complete, false);
    assert.equal(model.repertoire.teaching_core.complete, false);
    assert.ok(model.sources.some((id) => content.sources.some((source) => source.id === id && source.kind === "official-guidance")));
    assert.ok(model.reference_fonts.includes(font.id));
    assert.equal(font.correspondence.degree, "partial");
    assert.ok(font.correspondence.excludes.includes("authoritative-stroke-order"));
  }
});

for (const font of fonts) {
  test(`${font.name}: pinned bytes, identity, features, coverage and calibration`, () => {
    const bytes = readFileSync(resolve(root, font.files[0]));
    const metadata = inspectTrueType(bytes);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), font.integrity.sha256);
    assert.equal(bytes.length, font.integrity.bytes);
    assert.equal(font.upstream.release, "v1.003");
    assert.equal(font.upstream.commit, "36b6ee15dd64a9c64d1adfe19f6a0f602c39b5e4");
    assert.equal(font.font_version, "Version 1.003");
    assert.equal(font.weight, 400);
    assert.equal(font.style, "normal");
    assert.deepEqual(fontMetadataErrors(font, bytes), []);
    assert.ok(metadata.hasCharacter(germanCore + "0123456789.,?!"));
    assert.equal(metadata.hasCharacter("😀"), false);
    assert.equal(metadata.xHeightEm, font.calibration.x_height_em);
    assert.equal(metadata.ascenderEm, font.calibration.ascender_em);
    assert.equal(metadata.descenderEm, font.calibration.descender_em);
    assert.ok(metadata.xHeightEm > 0);
    assert.match(readFileSync(resolve(root, font.license_file), "utf8"), /Copyright 2023 The Playwrite Project Authors/);
    assert.match(readFileSync(resolve(root, font.license_file), "utf8"), /SIL OPEN FONT LICENSE Version 1.1/);
    assert.ok(fontMetadataErrors({ ...font, font_version: "wrong", family_name: "wrong", postscript_name: "wrong", shaping: { required_features: ["xxxx"] } }, bytes).length >= 4);
  });
}

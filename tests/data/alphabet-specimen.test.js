// SPDX-License-Identifier: Apache-2.0
import assert from "node:assert/strict";
import test from "node:test";
import { alphabetSpecimenForModel } from "../../src/lib/alphabet-specimen.ts";
import { loadContent, repertoireCharacters } from "../../tools/content.mjs";
import { loadLocalReferenceFont, UnsupportedFontFeaturesError } from "../../src/lib/browser-font-loader.ts";


test("local font loader enforces same-origin URLs and caches loaded faces", async () => {
  const names = ["window", "CSS", "document", "FontFace"];
  const previous = new Map(names.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  const registered = [];
  const sources = [];
  class MockFontFace {
    constructor(family, source) {
      this.family = family;
      sources.push(source);
    }

    async load() {
      return this;
    }
  }
  globalThis.window = { location: { href: "https://schreibatlas.test/de/", origin: "https://schreibatlas.test" } };
  globalThis.CSS = { supports: () => true };
  globalThis.document = { fonts: { add: (face) => registered.push(face) } };
  globalThis.FontFace = MockFontFace;

  try {
    const options = {
      fontId: "loader-test-font",
      family: "loader-test-family",
      urls: ["/assets/reference.ttf"],
      requiredFeatures: ["calt"],
    };
    const [first, second] = await Promise.all([
      loadLocalReferenceFont(options),
      loadLocalReferenceFont(options),
    ]);
    assert.equal(first, second);
    assert.equal(registered.length, 1);
    assert.deepEqual(sources, ['url("https://schreibatlas.test/assets/reference.ttf")']);
    await assert.rejects(loadLocalReferenceFont({ ...options, fontId: "external-font", urls: ["https://example.test/font.ttf"] }), /same-origin/);
    globalThis.CSS = { supports: () => false };
    await assert.rejects(
      loadLocalReferenceFont({ ...options, fontId: "unsupported-font" }),
      UnsupportedFontFeaturesError,
    );
  } finally {
    for (const [name, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  }
});
const content = loadContent();
const models = new Map(content.models.map((model) => [model.id, model]));

function groupCharacters(specimen, id) {
  return specimen.groups.find((group) => group.id === id)?.characters ?? [];
}

test("SAS specimen groups its recorded repertoire in the expected display order", () => {
  const model = models.get("de-sas");
  const specimen = alphabetSpecimenForModel(model);

  assert.deepEqual(groupCharacters(specimen, "uppercase"), [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"]);
  assert.deepEqual(groupCharacters(specimen, "lowercase"), [..."abcdefghijklmnopqrstuvwxyz"]);
  assert.deepEqual(groupCharacters(specimen, "special"), [..."ÄÖÜäöüß"]);
  assert.deepEqual(groupCharacters(specimen, "numerals"), [..."1234567890"]);
  assert.deepEqual(groupCharacters(specimen, "punctuation"), [".", ",", "?", "!"]);
  assert.equal(specimen.characterCount, 73);
});

test("Kurrent preserves recorded long s without inventing numerals", () => {
  const model = models.get("de-kurrent-loth-1866");
  const specimen = alphabetSpecimenForModel(model);
  const special = groupCharacters(specimen, "special");

  assert.ok(special.includes("ſ"));
  assert.deepEqual(groupCharacters(specimen, "numerals"), []);
  assert.equal(specimen.groups.some((group) => group.characters.some((character) => /[0-9]/u.test(character))), false);
});

test("specimen output has no duplicates and preserves every declared character", () => {
  const model = models.get("de-sas");
  const specimen = alphabetSpecimenForModel(model);
  const characters = specimen.groups.flatMap((group) => group.characters);

  assert.equal(new Set(characters).size, characters.length);
  assert.deepEqual(new Set(characters), new Set(repertoireCharacters(model)));
  assert.deepEqual(specimen, alphabetSpecimenForModel(model));
});

test("empty repertoire produces no specimen groups", () => {
  assert.deepEqual(alphabetSpecimenForModel({ character_repertoire: [] }), { groups: [], characterCount: 0 });
});

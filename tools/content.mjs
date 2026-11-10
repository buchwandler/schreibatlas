// SPDX-License-Identifier: Apache-2.0
import { glyphRouteSlug } from "./unicode.mjs";
import { validateDataset } from "./validate-data.mjs";

export const locales = ["de", "en"];
const recordTypes = ["countries", "languages", "models", "glyphs", "sources", "fonts", "strokes", "connections"];

export function loadContent(root = process.cwd()) {
  const { errors, records } = validateDataset({ root });
  if (errors.length) throw new Error(`Cannot render invalid canonical data:\n${errors.join("\n")}`);
  return Object.fromEntries(recordTypes.map((type) => [type, records[type].map(({ value }) => value)]));
}

export function localizedModelPaths(models) {
  return models.flatMap((model) => locales.map((lang) => ({ lang, id: model.id, model })));
}

export function localizedGlyphPaths(glyphs) {
  return glyphs.flatMap((glyph) => locales.map((lang) => ({
    lang,
    id: glyph.model,
    slug: glyphRouteSlug(glyph.character),
    glyph,
  })));
}

export function repertoireCharacters(model) {
  const characters = new Set();
  for (const entry of model.character_repertoire) {
    const [start, end = start] = entry.split("-").map((point) => Number.parseInt(point.slice(2), 16));
    for (let point = start; point <= end; point += 1) characters.add(String.fromCodePoint(point));
  }
  return [...characters];
}

export function localizedLetterPaths(models, glyphs) {
  return models.flatMap((model) => {
    const modelGlyphs = glyphs.filter((glyph) => glyph.model === model.id);
    const byCharacter = new Map(modelGlyphs.map((glyph) => [glyph.character, glyph]));
    const characters = [...new Set([...repertoireCharacters(model), ...byCharacter.keys()])];
    return characters.flatMap((character) => locales.map((lang) => ({
      lang, id: model.id, slug: glyphRouteSlug(character), character, model,
      glyph: byCharacter.get(character),
    })));
  });
}

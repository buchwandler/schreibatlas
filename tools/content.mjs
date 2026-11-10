// SPDX-License-Identifier: Apache-2.0
import { glyphRouteSlug } from "./unicode.mjs";
import { validateDataset } from "./validate-data.mjs";

export const locales = ["de", "en"];
const recordTypes = ["countries", "languages", "models", "glyphs", "sources", "fonts", "strokes"];

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

export function draftGlyphRecord({ model, character, unicode }) {
  return {
    model,
    character,
    unicode,
    forms: { isolated: { status: "draft" }, contextual: [] },
    metrics: { baseline: null, x_height: null, ascender: null, descender: null, cap_height: null, nominal_slant: null },
    reference: { font: null, glyph_name: null },
    connections: { entry: { present: null }, exit: { present: null } },
    variants: [],
    sources: [],
    verification: "draft",
    license: "CC-BY-SA-4.0",
  };
}

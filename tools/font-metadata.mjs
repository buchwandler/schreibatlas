// SPDX-License-Identifier: Apache-2.0
// Inspect the static TrueType assets used for local reference rendering.
export function inspectTrueType(bytes) {
  if (bytes.readUInt32BE(0) !== 0x00010000) throw new Error("Expected a static TrueType font.");
  const tables = new Map();
  for (let index = 0; index < bytes.readUInt16BE(4); index += 1) {
    const offset = 12 + index * 16;
    tables.set(bytes.toString("ascii", offset, offset + 4), bytes.readUInt32BE(offset + 8));
  }
  const table = (tag) => {
    if (!tables.has(tag)) throw new Error(`Missing TrueType table ${tag}.`);
    return tables.get(tag);
  };
  const head = table("head");
  const em = bytes.readUInt16BE(head + 18);
  const os2 = table("OS/2");
  const nameTable = table("name");
  const names = new Map();
  for (let index = 0; index < bytes.readUInt16BE(nameTable + 2); index += 1) {
    const row = nameTable + 6 + index * 12;
    const platform = bytes.readUInt16BE(row);
    const language = bytes.readUInt16BE(row + 4);
    const id = bytes.readUInt16BE(row + 6);
    const start = nameTable + bytes.readUInt16BE(nameTable + 4) + bytes.readUInt16BE(row + 10);
    const data = bytes.subarray(start, start + bytes.readUInt16BE(row + 8));
    const value = platform === 0 || platform === 3 ? Buffer.from(data).swap16().toString("utf16le") : data.toString("latin1");
    if (!names.has(id) || language === 0x409) names.set(id, value);
  }
  const cmap = table("cmap");
  const subtables = [];
  for (let index = 0; index < bytes.readUInt16BE(cmap + 2); index += 1) {
    const start = cmap + bytes.readUInt32BE(cmap + 4 + index * 8 + 4);
    const format = bytes.readUInt16BE(start);
    if (format === 4 || format === 12) subtables.push({ start, format });
  }
  subtables.sort((a, b) => b.format - a.format);
  function glyphIndex(point) {
    for (const { start, format } of subtables) {
      if (format === 12) {
        for (let group = 0; group < bytes.readUInt32BE(start + 12); group += 1) {
          const row = start + 16 + group * 12;
          const first = bytes.readUInt32BE(row);
          const last = bytes.readUInt32BE(row + 4);
          if (point >= first && point <= last) return bytes.readUInt32BE(row + 8) + point - first;
        }
      } else if (point <= 0xffff) {
        const count = bytes.readUInt16BE(start + 6) / 2;
        for (let segment = 0; segment < count; segment += 1) {
          const last = bytes.readUInt16BE(start + 14 + segment * 2);
          const first = bytes.readUInt16BE(start + 16 + count * 2 + segment * 2);
          if (point < first || point > last) continue;
          const delta = bytes.readInt16BE(start + 16 + count * 4 + segment * 2);
          const rangePosition = start + 16 + count * 6 + segment * 2;
          const range = bytes.readUInt16BE(rangePosition);
          if (range === 0) return (point + delta) & 0xffff;
          const glyph = bytes.readUInt16BE(rangePosition + range + (point - first) * 2);
          return glyph ? (glyph + delta) & 0xffff : 0;
        }
      }
    }
    return 0;
  }
  const features = new Set();
  for (const tag of ["GSUB", "GPOS"]) {
    if (!tables.has(tag)) continue;
    const start = table(tag);
    const list = start + bytes.readUInt16BE(start + 6);
    for (let index = 0; index < bytes.readUInt16BE(list); index += 1) features.add(bytes.toString("ascii", list + 2 + index * 6, list + 6 + index * 6));
  }
  const loca = table("loca");
  const glyf = table("glyf");
  const longLoca = bytes.readInt16BE(head + 50) === 1;
  const glyphOffset = (index) => longLoca ? bytes.readUInt32BE(loca + index * 4) : bytes.readUInt16BE(loca + index * 2) * 2;
  const xIndex = glyphIndex(0x78);
  if (!xIndex || glyphOffset(xIndex) === glyphOffset(xIndex + 1)) throw new Error("Font has no measurable lowercase x.");
  const xHeight = bytes.readInt16BE(glyf + glyphOffset(xIndex) + 8) / em;
  return {
    family: names.get(16) ?? names.get(1),
    postscriptName: names.get(6),
    version: names.get(5),
    weight: bytes.readUInt16BE(os2 + 4),
    italic: Boolean(bytes.readUInt16BE(os2 + 62) & 1),
    unitsPerEm: em,
    xHeightEm: xHeight,
    ascenderEm: bytes.readInt16BE(os2 + 68) / em,
    descenderEm: Math.abs(bytes.readInt16BE(os2 + 70)) / em,
    features: [...features].sort(),
    hasCharacter: (character) => [...character].every((point) => glyphIndex(point.codePointAt(0)) !== 0),
  };
}

export function fontMetadataErrors(font, bytes) {
  const metadata = inspectTrueType(bytes);
  const errors = [];
  if (font.font_version && metadata.version !== font.font_version) errors.push("font internal version mismatch");
  if (font.family_name && metadata.family !== font.family_name) errors.push("font family name mismatch");
  if (font.postscript_name && metadata.postscriptName !== font.postscript_name) errors.push("font PostScript name mismatch");
  if (font.weight && metadata.weight !== font.weight) errors.push("font weight mismatch");
  if (font.style === "normal" && metadata.italic) errors.push("font style mismatch");
  for (const feature of font.shaping?.required_features ?? []) {
    if (!metadata.features.includes(feature)) errors.push(`missing required OpenType feature ${feature}`);
  }
  return errors;
}

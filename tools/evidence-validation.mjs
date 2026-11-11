// SPDX-License-Identifier: Apache-2.0
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { basename, relative, resolve, sep } from "node:path";
import { unicodeCodePoints } from "./unicode.mjs";
import { fontMetadataErrors, inspectTrueType } from "./font-metadata.mjs";

export function evidenceErrors(records, root) {
  const errors = [];
  const models = new Map(records.models.map(({ value }) => [value.id, value]));
  const fonts = new Map(records.fonts.map(({ value }) => [value.id, value]));
  const sources = new Map(records.sources.map(({ value }) => [value.id, value]));
  const languages = new Set(records.languages.map(({ value }) => value.id));
  const glyphs = new Map(records.glyphs.map(({ value }) => [`${value.model}/${value.character}`, value]));
  const backed = new Set(["source-backed", "reviewed", "verified"]);
  const contains = (entries, point) => entries.some((entry) => {
    const [first, last = first] = entry.split("-").map((part) => Number.parseInt(part.slice(2), 16));
    return point >= first && point <= last;
  });
  const points = (entry) => {
    const [first, last = first] = entry.split("-").map((part) => Number.parseInt(part.slice(2), 16));
    if (first > last) return [];
    return Array.from({ length: last - first + 1 }, (_, index) => first + index);
  };
  function sourceRefs(path, ids, requireEvidence = false) {
    for (const id of ids ?? []) {
      if (!sources.has(id)) errors.push(`${path}: unresolved source reference "${id}".`);
      else if (sources.get(id).kind === "project-placeholder") errors.push(`${path}: nested evidence cannot cite placeholder source "${id}".`);
    }
    if (requireEvidence && !(ids ?? []).some((id) => sources.has(id) && sources.get(id).kind !== "project-placeholder")) {
      errors.push(`${path}: claimed evidence requires at least one non-placeholder source.`);
    }
  }
  function localFile(filePath, label) {
    const target = resolve(root, filePath);
    if (!target.startsWith(`${resolve(root)}${sep}`)) {
      errors.push(`${label}: referenced file must stay inside the repository: "${filePath}".`);
      return null;
    }
    if (!existsSync(target)) {
      errors.push(`${label}: referenced file does not exist: "${filePath}".`);
      return null;
    }
    return readFileSync(target);
  }
  const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
  function generatedFontErrors(name, font) {
    const derivation = font.derivation;
    if (font.upstream?.kind === "archive" && !derivation) errors.push(`${name}: archive-backed font requires generated derivation metadata.`);
    if (!derivation) return;
    if (font.upstream?.kind !== "archive") errors.push(`${name}: generated derivation requires archive upstream metadata.`);
    if (derivation.output_format !== font.format) errors.push(`${name}: generated output format does not match font format.`);

    localFile(derivation.recipe, name);
    const mapping = localFile(derivation.unicode_mapping, name);
    if (mapping && sha256(mapping) !== derivation.unicode_mapping_sha256) errors.push(`${name}: Unicode mapping SHA-256 mismatch.`);
    if (derivation.connection_mapping) localFile(derivation.connection_mapping, name);
    const tfm = localFile(derivation.tfm_file, name);
    if (tfm && sha256(tfm) !== derivation.tfm_sha256) errors.push(`${name}: TFM SHA-256 mismatch.`);
    const provenanceBytes = localFile(derivation.provenance_file, name);
    if (!provenanceBytes) return;

    let provenance;
    try {
      provenance = JSON.parse(provenanceBytes.toString("utf8"));
    } catch (error) {
      errors.push(`${name}: derivation provenance is invalid JSON: ${error.message}.`);
      return;
    }
    const upstream = font.upstream;
    const record = provenance.upstream ?? {};
    if (upstream?.kind === "archive") {
      if (record.archive_sha256 !== upstream.sha256) errors.push(`${name}: provenance archive SHA-256 mismatch.`);
      if (record.archive) {
        const archive = localFile(record.archive, name);
        if (archive && sha256(archive) !== upstream.sha256) errors.push(`${name}: pinned archive SHA-256 mismatch.`);
      }
      if (font.integrity?.sha256 === upstream.sha256) errors.push(`${name}: archive checksum and generated font integrity must remain distinct.`);
      if (record.package !== upstream.package || String(record.version) !== upstream.version) errors.push(`${name}: provenance upstream package or version mismatch.`);
      const member = upstream.source_file.replaceAll("\\", "/");
      if (member.startsWith("/") || member.split("/").includes("..")) errors.push(`${name}: upstream source file must be an archive-relative path.`);
      if (!record.source_files?.[basename(member)]) errors.push(`${name}: upstream source file is absent from provenance.`);
      if (font.license !== record.license) errors.push(`${name}: provenance upstream license mismatch.`);
    }
    const actual = provenance.derivation ?? {};
    if (actual.recipe !== derivation.recipe) errors.push(`${name}: provenance recipe mismatch.`);
    if (actual.tfm_path !== derivation.tfm_file || actual.tfm_sha256 !== derivation.tfm_sha256) errors.push(`${name}: provenance TFM metadata mismatch.`);
    if (actual.unicode_mapping !== derivation.unicode_mapping || provenance.profile?.mapping_sha256 !== derivation.unicode_mapping_sha256) errors.push(`${name}: provenance Unicode mapping metadata mismatch.`);
    if (JSON.stringify(actual.pipeline) !== JSON.stringify(derivation.pipeline)) errors.push(`${name}: provenance pipeline mismatch.`);
    const sorted = (value) => JSON.stringify(Object.fromEntries(Object.entries(value ?? {}).sort(([left], [right]) => left.localeCompare(right))));
    if (sorted(actual.tool_versions) !== sorted(derivation.toolchain)) errors.push(`${name}: provenance toolchain mismatch.`);
    if (font.integrity?.sha256 !== provenance.artifact?.sha256) errors.push(`${name}: provenance artifact SHA-256 mismatch.`);
    const facts = actual.font_facts ?? {};
    if (font.family_name !== facts.family_name || font.family_name !== provenance.artifact?.family_name) errors.push(`${name}: provenance family name mismatch.`);
    if (font.postscript_name !== facts.postscript_name || font.postscript_name !== provenance.artifact?.postscript_name) errors.push(`${name}: provenance PostScript name mismatch.`);
    const features = (font.shaping?.required_features ?? []).slice().sort();
    const emittedFeatures = (facts.opentype_features ?? []).slice().sort();
    if (JSON.stringify(features) !== JSON.stringify(emittedFeatures)) errors.push(`${name}: declared shaping features do not match the generated font features.`);
    if (provenance.artifact?.path) {
      const artifact = localFile(provenance.artifact.path, name);
      if (artifact && sha256(artifact) !== provenance.artifact.sha256) errors.push(`${name}: provenance artifact file SHA-256 mismatch.`);
    }
  }
  function outlineErrors(path, outline) {
    if (!outline) return;
    if (outline.view_box[2] <= 0 || outline.view_box[3] <= 0 || outline.baseline <= outline.x_height) errors.push(`${path}: invalid variant outline geometry.`);
  }
  for (const { path, value: model } of records.models) {
    const name = relative(root, path);
    if (model.period?.from != null && model.period?.to != null && model.period.from > model.period.to) errors.push(`${name}: period starts after it ends.`);
    for (const region of model.regions ?? []) {
      if (!region.startsWith(`${model.country}-`)) errors.push(`${name}: region "${region}" does not belong to model country.`);
    }
    for (const [category, scope] of Object.entries(model.repertoire ?? {})) {
      sourceRefs(`${name} repertoire.${category}`, scope.sources, scope.complete);
      for (const entry of scope.entries) {
        const values = points(entry);
        if (!values.length) errors.push(`${name}: reversed repertoire range "${entry}".`);
        for (const point of values) {
          if (!contains(model.character_repertoire, point)) errors.push(`${name}: scoped repertoire entry is absent from character_repertoire: U+${point.toString(16).toUpperCase()}.`);
        }
      }
    }
    for (const example of [...(model.examples?.words ?? []), ...(model.examples?.sentences ?? [])]) {
      sourceRefs(`${name} example`, example.sources, true);
      if (!languages.has(example.language)) errors.push(`${name}: unresolved example language "${example.language}".`);
    }
    for (const entry of model.character_repertoire) {
      if (!points(entry).length) errors.push(`${name}: reversed repertoire range "${entry}".`);
    }
  }
  for (const { path, value: font } of records.fonts) {
    const name = relative(root, path);
    const model = models.get(font.correspondence.model);
    if (model && !model.reference_fonts.includes(font.id)) errors.push(`${name}: corresponding model must reference font "${font.id}" back.`);
    sourceRefs(`${name} correspondence`, font.correspondence.sources);
    generatedFontErrors(name, font);
    if (font.integrity) {
      const asset = resolve(root, font.files[0]);
      if (asset.startsWith(`${resolve(root)}${sep}`) && existsSync(asset)) {
        const bytes = readFileSync(asset);
        if (bytes.length !== font.integrity.bytes) errors.push(`${name}: font integrity byte count mismatch.`);
        if (createHash("sha256").update(bytes).digest("hex") !== font.integrity.sha256) errors.push(`${name}: font integrity SHA-256 mismatch.`);
        try {
          errors.push(...fontMetadataErrors(font, bytes).map((message) => `${name}: ${message}.`));
          const metadata = inspectTrueType(bytes);
          if (font.calibration?.x_height_method?.startsWith("TrueType cmap") && Math.abs(font.calibration.x_height_em - metadata.xHeightEm) > 0.000001) errors.push(`${name}: measured x-height calibration mismatch.`);
          if (model) {
            for (const entry of model.character_repertoire) {
              for (const point of points(entry)) {
                if (!metadata.hasCharacter(String.fromCodePoint(point))) errors.push(`${name}: required character U+${point.toString(16).toUpperCase()} is absent from font.`);
              }
            }
          }
        } catch (error) {
          errors.push(`${name}: invalid pinned TrueType font: ${error.message}`);
        }
      }
    }
  }
  for (const { path, value: glyph } of records.glyphs) {
    const name = relative(root, path);
    const derivation = glyph.derivation;
    if (derivation) {
      if (derivation.source_font && !fonts.has(derivation.source_font)) errors.push(`${name}: unresolved derivation font "${derivation.source_font}".`);
      if (backed.has(derivation.verification)) sourceRefs(`${name} derivation`, glyph.sources, true);
      if (derivation.kind === "font-derived" && !derivation.does_not_establish.includes("official-stroke-order")) errors.push(`${name}: font-derived representation must exclude official-stroke-order.`);
    }
    for (const claim of glyph.source_claims ?? []) sourceRefs(`${name} ${claim.field}`, claim.sources, true);
    const variantIds = new Set();
    for (const variant of glyph.variants.filter((variant) => typeof variant !== "string")) {
      if (variantIds.has(variant.id)) errors.push(`${name}: duplicate variant id "${variant.id}".`);
      variantIds.add(variant.id);
      sourceRefs(`${name} variant ${variant.id}`, variant.sources, backed.has(variant.status) || Boolean(variant.outline));
      outlineErrors(name, variant.outline);
    }
  }
  const pairs = new Set();
  for (const { path, value: connection } of records.connections) {
    const name = relative(root, path);
    const model = models.get(connection.model);
    const key = `${connection.model}/${connection.left}/${connection.right}`;
    if (pairs.has(key)) errors.push(`${name}: duplicate connection pair "${key}".`);
    pairs.add(key);
    if (!model) errors.push(`${name}: unresolved model reference "${connection.model}".`);
    sourceRefs(name, connection.sources, backed.has(connection.status));
    if (connection.reference.shaped_text !== connection.left + connection.right) errors.push(`${name}: shaped_text must match the connection sequence.`);
    const font = fonts.get(connection.reference.font);
    if (connection.reference.font && (!font || !model?.reference_fonts.includes(font.id))) errors.push(`${name}: connection font must be a reference font of its model.`);
    for (const side of ["left", "right"]) {
      for (const code of unicodeCodePoints(connection[side])) {
        if (model && !contains(model.character_repertoire, Number.parseInt(code.slice(2), 16))) errors.push(`${name}: connection character is outside the declared repertoire.`);
      }
      const variant = connection.behavior[`${side}_variant`];
      if (variant && !glyphs.get(`${connection.model}/${connection[side]}`)?.variants.some((entry) => typeof entry !== "string" && entry.id === variant)) errors.push(`${name}: unresolved ${side} variant "${variant}".`);
    }
  }
  return errors;
}

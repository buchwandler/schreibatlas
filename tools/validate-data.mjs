// SPDX-License-Identifier: Apache-2.0
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import licenseIds from "spdx-license-ids" with { type: "json" };
import { parse } from "yaml";
import { glyphFileName, glyphRouteSlug, unicodeCodePoints } from "./unicode.mjs";
import { parseStrokeSvg } from "./stroke-assets.mjs";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const typeSchemas = {
  countries: "country",
  languages: "language",
  models: "model",
  glyphs: "glyph",
  sources: "source",
  fonts: "font",
  strokes: "stroke",
};
const schemaNames = Object.values(typeSchemas);
const validLicenses = new Set(licenseIds);

function yamlFiles(directory) {
  const absolute = resolve(directory);
  if (!existsSync(absolute)) return [];
  return readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(absolute, entry.name);
    return entry.isDirectory() ? yamlFiles(path) : entry.isFile() && entry.name.endsWith(".yaml") ? [path] : [];
  }).sort();
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function pointValue(codePoint) {
  return Number.parseInt(codePoint.slice(2), 16);
}

function repertoireContains(entry, codePoint) {
  const [start, end] = entry.split("-");
  const value = pointValue(codePoint);
  return value >= pointValue(start) && value <= pointValue(end ?? start);
}

function addReferenceErrors(errors, path, field, ids, records, type) {
  for (const id of ids ?? []) {
    if (!records.has(id)) errors.push(`${path}: unresolved ${field} reference "${id}" (${type}).`);
  }
}


const evidenceVerificationStatuses = new Set(["source-backed", "reviewed", "verified"]);

function hasNonPlaceholderSource(sourceIds, sourceRecords) {
  return (sourceIds ?? []).some((id) => sourceRecords.has(id) && sourceRecords.get(id).kind !== "project-placeholder");
}

function addEvidenceErrors(errors, path, statuses, sourceIds, sourceRecords) {
  const claimedStatus = statuses.find((status) => evidenceVerificationStatuses.has(status));
  if (claimedStatus && !hasNonPlaceholderSource(sourceIds, sourceRecords)) {
    errors.push(`${path}: ${claimedStatus} verification requires at least one non-placeholder source.`);
  }
}

function addPlaceholderSourceErrors(errors, path, sourceIds, sourceRecords) {
  for (const id of sourceIds ?? []) {
    if (sourceRecords.get(id)?.kind === "project-placeholder") {
      errors.push(`${path}: non-demo record cannot cite placeholder source "${id}".`);
    }
  }
}
function recordMap(records, type, errors) {
  const byId = new Map();
  for (const { path, value } of records) {
    if (!value || typeof value !== "object" || typeof value.id !== "string") continue;
    if (byId.has(value.id)) errors.push(`${path}: duplicate ${type} id "${value.id}" also found in ${byId.get(value.id)}.`);
    else byId.set(value.id, path);
  }
  return byId;
}

function addSchemaErrors(ajv, schemaName, records, errors, root) {
  const validate = ajv.getSchema(`https://schreibatlas.de/schema/v1/${schemaName}.schema.json`);
  const validPaths = new Set();
  for (const { path, value } of records) {
    if (validate(value)) {
      validPaths.add(path);
      continue;
    }
    for (const error of validate.errors ?? []) {
      const location = error.instancePath || "/";
      errors.push(`${relative(root, path).split(sep).join("/")}: ${location} ${error.message}.`);
    }
  }
  return validPaths;
}

function addLicenseError(errors, path, license) {
  if (license != null && !validLicenses.has(license)) {
    errors.push(`${path}: "${license}" is not a recognized SPDX license identifier.`);
  }
}

function addAssetError(errors, root, path, assetPath) {
  const resolved = resolve(root, assetPath);
  if (!resolved.startsWith(`${resolve(root)}${sep}`)) {
    errors.push(`${path}: referenced asset must stay inside the repository: "${assetPath}".`);
  } else if (!existsSync(resolved)) {
    errors.push(`${path}: referenced asset does not exist: "${assetPath}".`);
  }
}

function addSvgErrors(errors, root, path, assetPath) {
  const resolved = resolve(root, assetPath);
  if (!existsSync(resolved) || !resolved.startsWith(`${resolve(root)}${sep}`)) return null;

  try {
    return parseStrokeSvg(readFileSync(resolved, "utf8"), assetPath);
  } catch (error) {
    errors.push(`${path}: malformed SVG "${assetPath}": ${error.message}`);
    return null;
  }
}

export function validateDataset({ root = projectRoot } = {}) {
  const repositoryRoot = resolve(root);
  const errors = [];
  const records = Object.fromEntries(Object.keys(typeSchemas).map((key) => [key, []]));
  const validRecords = Object.fromEntries(Object.keys(typeSchemas).map((key) => [key, new Set()]));
  const schemas = resolve(repositoryRoot, "schema");
  const ajv = new Ajv2020({ allErrors: true, strict: false });

  ajv.addSchema(readJson(resolve(schemas, "common.schema.json")));
  for (const name of schemaNames) ajv.addSchema(readJson(resolve(schemas, `${name}.schema.json`)));

  for (const [directory, schemaName] of Object.entries(typeSchemas)) {
    for (const path of yamlFiles(resolve(repositoryRoot, "data", directory))) {
      let value;
      try {
        value = parse(readFileSync(path, "utf8"));
      } catch (error) {
        errors.push(`${relative(repositoryRoot, path).split(sep).join("/")}: invalid YAML: ${error.message}`);
        continue;
      }
      records[directory].push({ path, value });
    }
    validRecords[directory] = addSchemaErrors(ajv, schemaName, records[directory], errors, repositoryRoot);
  }

  const countries = recordMap(records.countries.filter(({ path }) => validRecords.countries.has(path)), "country", errors);
  const languages = recordMap(records.languages.filter(({ path }) => validRecords.languages.has(path)), "language", errors);
  const validModels = records.models.filter(({ path }) => validRecords.models.has(path));
  const models = recordMap(validModels, "model", errors);
  const modelRecords = new Map(validModels.map(({ value }) => [value.id, value]));
  const glyphsByRoute = new Map();
  const sources = recordMap(records.sources.filter(({ path }) => validRecords.sources.has(path)), "source", errors);
  const fonts = recordMap(records.fonts.filter(({ path }) => validRecords.fonts.has(path)), "font", errors);

  const sourceRecordsById = new Map(records.sources.filter(({ path }) => validRecords.sources.has(path)).map(({ value }) => [value.id, value]));
  addLicenseError(errors, "package.json", readJson(resolve(repositoryRoot, "package.json")).license);

  for (const { path, value } of records.models) {
    if (!validRecords.models.has(path)) continue;
    if (!value || typeof value !== "object") continue;
    const relativePath = relative(repositoryRoot, path).split(sep).join("/");
    const directoryId = relativePath.split("/")[2];
    if (directoryId && directoryId !== value.id) {
      errors.push(`${relativePath}: model id "${value.id}" must match directory "${directoryId}".`);
    }
    if (value.country && !countries.has(value.country)) errors.push(`${relativePath}: unresolved country reference "${value.country}".`);
    addReferenceErrors(errors, relativePath, "language", value.languages, languages, "language");
    addReferenceErrors(errors, relativePath, "source", value.sources, sources, "source");
    addReferenceErrors(errors, relativePath, "font", value.reference_fonts, fonts, "font");
    if (value.demo !== true) addPlaceholderSourceErrors(errors, relativePath, value.sources, sourceRecordsById);
    addEvidenceErrors(errors, relativePath, [value.status?.verification], value.sources, sourceRecordsById);
    addLicenseError(errors, relativePath, value.license);
  }

  for (const { path, value } of records.sources) {
    if (!validRecords.sources.has(path)) continue;
    if (value && typeof value === "object") addLicenseError(errors, relative(repositoryRoot, path), value.rights?.license);
  }

  for (const { path, value } of records.fonts) {
    if (!validRecords.fonts.has(path)) continue;
    if (!value || typeof value !== "object") continue;
    const relativePath = relative(repositoryRoot, path).split(sep).join("/");
    addLicenseError(errors, relativePath, value.license);
    addReferenceErrors(errors, relativePath, "source", value.sources, sources, "source");
    addPlaceholderSourceErrors(errors, relativePath, value.sources, sourceRecordsById);
    if (value.correspondence?.model && !models.has(value.correspondence.model)) {
      errors.push(`${relativePath}: unresolved model reference "${value.correspondence.model}".`);
    }
    for (const assetPath of value.files ?? []) addAssetError(errors, repositoryRoot, relativePath, assetPath);
    if (value.license_file) addAssetError(errors, repositoryRoot, relativePath, value.license_file);
  }

  for (const { path, value } of records.glyphs) {
    if (!validRecords.glyphs.has(path)) continue;
    if (!value || typeof value !== "object") continue;
    const relativePath = relative(repositoryRoot, path).split(sep).join("/");
    addLicenseError(errors, relativePath, value.license);
    addReferenceErrors(errors, relativePath, "source", value.sources, sources, "source");
    const referencedModel = modelRecords.get(value.model);
    if (referencedModel && referencedModel.demo !== true) addPlaceholderSourceErrors(errors, relativePath, value.sources, sourceRecordsById);
    addEvidenceErrors(errors, relativePath, [value.verification, value.forms?.isolated?.status, ...(value.forms?.contextual ?? []).map(({ status }) => status)], value.sources, sourceRecordsById);
    if (!models.has(value.model)) {
      errors.push(`${relativePath}: unresolved model reference "${value.model}".`);
      continue;
    }
    if (JSON.stringify(value.unicode) !== JSON.stringify(unicodeCodePoints(value.character))) {
      errors.push(`${relativePath}: unicode entries do not match the character value.`);
    }
    const expectedPath = `data/glyphs/${value.model}/${glyphFileName(value.character)}`;
    if (relativePath !== expectedPath) errors.push(`${relativePath}: glyph file must be named ${expectedPath}.`);

    const route = `${value.model}/${glyphRouteSlug(value.character)}`;
    if (glyphsByRoute.has(route)) errors.push(`${relativePath}: duplicate canonical glyph route "${route}" also found in ${glyphsByRoute.get(route)}.`);
    else glyphsByRoute.set(route, relativePath);

    const model = modelRecords.get(value.model);
    for (const codePoint of value.unicode ?? []) {
      if (!model.character_repertoire.some((entry) => repertoireContains(entry, codePoint))) {
        errors.push(`${relativePath}: ${codePoint} is not declared in model "${value.model}" character_repertoire.`);
      }
    }
    const fontId = value.reference?.font;
    if (fontId && !fonts.has(fontId)) errors.push(`${relativePath}: unresolved font reference "${fontId}".`);
    if (value.outline) {
      const [, , width, height] = value.outline.view_box;
      if (width <= 0 || height <= 0) errors.push(`${relativePath}: outline view_box width and height must be positive.`);
      if (value.outline.baseline <= value.outline.x_height) errors.push(`${relativePath}: outline baseline must be below its x-height in SVG coordinates.`);
    }
    for (const form of value.forms?.contextual ?? []) {
      if (!form.outline) continue;
      if (!value.sources?.length) errors.push(`${relativePath}: contextual outlines require at least one source reference.`);
      const [, , width, height] = form.outline.view_box;
      if (width <= 0 || height <= 0) errors.push(`${relativePath}: contextual outline view_box width and height must be positive.`);
      if (form.outline.baseline <= form.outline.x_height) errors.push(`${relativePath}: contextual outline baseline must be below its x-height.`);
    }
  }

  const strokeRoutes = new Set();
  for (const { path, value } of records.strokes) {
    if (!validRecords.strokes.has(path)) continue;
    if (!value || typeof value !== "object") continue;
    const relativePath = relative(repositoryRoot, path).split(sep).join("/");
    addLicenseError(errors, relativePath, value.license);
    addReferenceErrors(errors, relativePath, "source", value.sources, sources, "source");
    const model = modelRecords.get(value.model);
    if (model && model.demo !== true) addPlaceholderSourceErrors(errors, relativePath, value.sources, sourceRecordsById);
    addEvidenceErrors(errors, relativePath, [value.verification], value.sources, sourceRecordsById);
    if (!models.has(value.model)) errors.push(`${relativePath}: unresolved model reference "${value.model}".`);
    const route = `${value.model}/${glyphRouteSlug(value.character)}`;
    if (strokeRoutes.has(route)) errors.push(`${relativePath}: duplicate stroke record route "${route}".`);
    strokeRoutes.add(route);
    if (!glyphsByRoute.has(route)) errors.push(`${relativePath}: stroke record has no matching glyph record for "${route}".`);
    const steps = value.strokes ?? [];
    const orders = steps.map((stroke) => stroke.order);
    if (new Set(orders).size !== orders.length || orders.some((order, index) => order !== index + 1)) {
      errors.push(`${relativePath}: stroke order values must be unique and contiguous from 1.`);
    }
    for (const stroke of steps) {
      addAssetError(errors, repositoryRoot, relativePath, stroke.file);
      addSvgErrors(errors, repositoryRoot, relativePath, stroke.file);
    }
  }

  for (const { path, value: model } of records.models) {
    if (!validRecords.models.has(path)) continue;
    if (!model || typeof model !== "object" || model.character_repertoire_complete !== true) continue;
    const relativePath = relative(repositoryRoot, path).split(sep).join("/");
    for (const entry of model.character_repertoire) {
      const [start, end] = entry.split("-");
      for (let point = pointValue(start); point <= pointValue(end ?? start); point += 1) {
        const codePoint = `U+${point.toString(16).toUpperCase().padStart(4, "0")}`;
        const glyphRoute = `${model.id}/u${codePoint.slice(2).toLowerCase()}`;
        if (!glyphsByRoute.has(glyphRoute)) errors.push(`${relativePath}: complete repertoire is missing glyph data for ${codePoint}.`);
      }
    }
  }

  return { errors, records };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { errors } = validateDataset();
  if (errors.length) {
    for (const error of errors) console.error(`ERROR ${error}`);
    console.error(`Data validation failed with ${errors.length} error(s).`);
    process.exitCode = 1;
  } else {
    console.log("Data schemas, references, licenses, repertoire, assets, and Unicode routes are valid.");
  }
}

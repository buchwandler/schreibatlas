import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { glyphRouteSlug } from "./unicode.mjs";
import { validateDataset } from "./validate-data.mjs";
import { parseStrokeSvg } from "./stroke-assets.mjs";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));

function normalizedBasePath(value) {
  if (!value || value === "/") return "";
  if (!value.startsWith("/")) throw new Error(`SITE_BASE_PATH must start with a slash: ${value}`);
  return value.replace(/\/+$/, "");
}

function sortedValues(records) {
  return records.map(({ value }) => value).sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0);
}


function renderedStrokeSvg(paths, penDown) {
  const dash = penDown ? "" : ' stroke-dasharray="0.03 0.02"';
  const pathElements = paths.map((path) => `  <path d="${path}" fill="none" stroke="#1d1d1b" stroke-width="0.02" stroke-linecap="round" stroke-linejoin="round"${dash}/>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1">\n${pathElements.join("\n")}\n</svg>\n`;
}
export function validateGeneratedUrls(urls, { apiPrefix, targetDirectory, generatedFiles }) {
  for (const url of urls) {
    const urlPrefix = `${apiPrefix}/`;
    if (!url.startsWith(urlPrefix)) throw new Error(`Generated internal URL is outside the versioned API: ${url}`);
    const path = url.slice(urlPrefix.length);
    if (!generatedFiles.has(path)) throw new Error(`Generated internal URL does not resolve to an export: ${url}`);
    if (!existsSync(resolve(targetDirectory, path))) throw new Error(`Generated internal URL target is missing: ${url}`);
  }
}

export function buildData({ root = projectRoot, outputDir = resolve(root, "public/data/v1"), basePath = process.env.SITE_BASE_PATH ?? "" } = {}) {
  const repositoryRoot = resolve(root);
  const targetDirectory = resolve(outputDir);
  const base = normalizedBasePath(basePath);
  const { errors, records } = validateDataset({ root: repositoryRoot });
  if (errors.length) throw new Error(`Cannot build data exports:\n${errors.join("\n")}`);

  const packageJson = JSON.parse(readFileSync(resolve(repositoryRoot, "package.json"), "utf8"));
  const apiPrefix = `${base}/data/v1`;
  let generatedAt = null;
  if (process.env.SOURCE_DATE_EPOCH !== undefined) {
    const epoch = Number(process.env.SOURCE_DATE_EPOCH);
    const date = new Date(epoch * 1000);
    if (!Number.isFinite(epoch) || Number.isNaN(date.getTime())) throw new Error("SOURCE_DATE_EPOCH must be a valid Unix timestamp.");
    generatedAt = date.toISOString();
  }

  rmSync(targetDirectory, { recursive: true, force: true });
  mkdirSync(targetDirectory, { recursive: true });
  const generatedFiles = new Set();

  function writeJson(path, value) {
    const absolutePath = resolve(targetDirectory, path);
    if (!absolutePath.startsWith(`${targetDirectory}${sep}`)) throw new Error(`Generated path is outside the data output: ${path}`);
    if (generatedFiles.has(path)) throw new Error(`Duplicate generated data path: ${path}`);
    mkdirSync(resolve(absolutePath, ".."), { recursive: true });
    writeFileSync(absolutePath, `${JSON.stringify(value, null, 2)}\n`);
    generatedFiles.add(path);
  }

  const models = sortedValues(records.models);
  const glyphs = records.glyphs.map(({ value }) => value)
    .sort((left, right) => {
      const leftRoute = `${left.model}/${glyphRouteSlug(left.character)}`;
      const rightRoute = `${right.model}/${glyphRouteSlug(right.character)}`;
      return leftRoute < rightRoute ? -1 : leftRoute > rightRoute ? 1 : 0;
    });
  const glyphIndex = glyphs.map((glyph) => ({
    model: glyph.model,
    character: glyph.character,
    unicode: glyph.unicode,
    slug: glyphRouteSlug(glyph.character),
    verification: glyph.verification,
    url: `${apiPrefix}/glyphs/${glyph.model}/${glyphRouteSlug(glyph.character)}.json`,
  }));
  const sources = sortedValues(records.sources);
  const fonts = sortedValues(records.fonts);
  const fontExports = fonts.map((font) => ({
    ...font,
    file_urls: font.files.map((file, index) => {
      const assetPath = `assets/fonts/${font.id}/${index + 1}-${basename(file)}`;
      const outputPath = resolve(targetDirectory, assetPath);
      if (!outputPath.startsWith(`${targetDirectory}${sep}`)) throw new Error(`Font asset path is outside the data output: ${assetPath}`);
      mkdirSync(resolve(outputPath, ".."), { recursive: true });
      copyFileSync(resolve(repositoryRoot, file), outputPath);
      generatedFiles.add(assetPath);
      return `${apiPrefix}/${assetPath}`;
    }),
  }));

  const strokes = records.strokes.map(({ value }) => value).sort((left, right) => {
    const leftRoute = `${left.model}/${glyphRouteSlug(left.character)}`;
    const rightRoute = `${right.model}/${glyphRouteSlug(right.character)}`;
    return leftRoute < rightRoute ? -1 : leftRoute > rightRoute ? 1 : 0;
  });
  const strokeExports = strokes.map((record) => ({
    ...record,
    strokes: [...record.strokes].sort((left, right) => left.order - right.order).map((step) => {
      const slug = glyphRouteSlug(record.character);
      const assetPath = `assets/strokes/${record.model}/${slug}-${String(step.order).padStart(2, "0")}.svg`;
      const outputPath = resolve(targetDirectory, assetPath);
      if (!outputPath.startsWith(`${targetDirectory}${sep}`)) throw new Error(`Stroke asset path is outside the data output: ${assetPath}`);
      mkdirSync(resolve(outputPath, ".."), { recursive: true });
      const { paths } = parseStrokeSvg(readFileSync(resolve(repositoryRoot, step.file), "utf8"), step.file);
      writeFileSync(outputPath, renderedStrokeSvg(paths, step.pen_down));
      generatedFiles.add(assetPath);
      return { ...step, file_url: `${apiPrefix}/${assetPath}` };
    }),
  }));
  const strokeIndex = strokeExports.map((stroke) => ({
    model: stroke.model,
    character: stroke.character,
    slug: glyphRouteSlug(stroke.character),
    verification: stroke.verification,
    url: `${apiPrefix}/strokes/${stroke.model}/${glyphRouteSlug(stroke.character)}.json`,
  }));

  for (const model of models) writeJson(`models/${model.id}.json`, model);
  for (const glyph of glyphs) writeJson(`glyphs/${glyph.model}/${glyphRouteSlug(glyph.character)}.json`, glyph);
  writeJson("models.json", models.map((model) => ({ ...model, url: `${apiPrefix}/models/${model.id}.json` })));
  writeJson("sources.json", sources);
  writeJson("fonts.json", fontExports);
  writeJson("glyphs.json", glyphIndex);
  writeJson("strokes.json", strokeIndex);
  for (const stroke of strokeExports) writeJson(`strokes/${stroke.model}/${glyphRouteSlug(stroke.character)}.json`, stroke);

  const index = {
    schemaVersion: 1,
    datasetVersion: packageJson.version,
    generatedAt,
    models: `${apiPrefix}/models.json`,
    sources: `${apiPrefix}/sources.json`,
    fonts: `${apiPrefix}/fonts.json`,
    glyphs: `${apiPrefix}/glyphs.json`,
    strokes: `${apiPrefix}/strokes.json`,
  };
  writeJson("index.json", index);

  const expectedUrls = [index.models, index.sources, index.fonts, index.glyphs, index.strokes, ...models.map((model) => `${apiPrefix}/models/${model.id}.json`), ...glyphIndex.map((glyph) => glyph.url), ...fontExports.flatMap((font) => font.file_urls), ...strokeIndex.map((stroke) => stroke.url), ...strokeExports.flatMap((stroke) => stroke.strokes.map((step) => step.file_url))];
  validateGeneratedUrls(expectedUrls, { apiPrefix, targetDirectory, generatedFiles });

  return {
    files: [...generatedFiles].sort(),
    output: relative(repositoryRoot, targetDirectory).split(sep).join("/"),
    index,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = buildData();
    console.log(`Generated ${result.files.length} deterministic data files in ${result.output}.`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

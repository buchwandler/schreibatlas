// SPDX-License-Identifier: Apache-2.0
import { normalizeOutline } from "../../tools/geometry.mjs";
import { decodeWorksheetSettings, encodeWorksheetSettings, layoutWorksheet, normalizeWorksheetSettings, worksheetId, worksheetMarker, worksheetMarkerLayout } from "../../tools/worksheet.mjs";
import { appendWorksheetMetadataToPng, createWorksheetPdf } from "../../tools/worksheet-export.mjs";
import type { FontRecord, GlyphRecord, SourceRecord } from "../../tools/content.mjs";
import type { WorksheetSettings } from "../../tools/worksheet.mjs";

const svgNamespace = "http://www.w3.org/2000/svg";

interface ApiIndex {
  datasetVersion: string;
  glyphs: string;
  sources: string;
  fonts: string;
}

interface GlyphIndexEntry {
  model: string;
  character: string;
  url: string;
}

interface WorksheetMessages {
  svgTitle: string;
  promptPrefix: string;
  modelLabel: string;
  reference: string;
  trace: string;
  blank: string;
  baselineLabel: string;
  xHeightLabel: string;
  textPromptNote: string;
  guideLegend: string;
  loading: string;
  ready: string;
  noModels: string;
  noOutlines: string;
  missingOutlines: string;
  overflow: string;
  error: string;
  exportError: string;
  provenance: string;
  copyLinkSuccess: string;
  copyLinkError: string;
  sourceCredits: string;
  verification: Record<string, { label: string }>;
}

interface ModelWorksheetData {
  id: string;
  name: string;
  license: string;
  verification: string;
  demo: boolean;
  direction: "ltr" | "rtl";
  sources: string[];
  fontId: string;
  fontSupported: string[];
}

interface WorksheetFont {
  record: FontRecord & { calibration: { x_height_em: number } };
  family: string;
  dataUrl: string;
  licenseText: string;
}
const root = document.querySelector<HTMLElement>("[data-worksheet]");
if (root) initializeWorksheet(root);

async function initializeWorksheet(container: HTMLElement): Promise<void> {
  const modelSelect = container.querySelector<HTMLSelectElement>("[data-model-select]");
  const referenceKind = container.querySelector<HTMLSelectElement>("[data-reference-kind]")!;
  const textInput = container.querySelector<HTMLInputElement>("[data-text-input]");
  const presetSelect = container.querySelector<HTMLSelectElement>("[data-preset-select]");
  const paperSelect = container.querySelector<HTMLSelectElement>("[data-paper-select]");
  const marginSelect = container.querySelector<HTMLSelectElement>("[data-margin-select]");
  const rowHeightSelect = container.querySelector<HTMLSelectElement>("[data-row-height-select]");
  const guidesSelect = container.querySelector<HTMLSelectElement>("[data-guides-select]");
  const referenceCheckbox = container.querySelector<HTMLInputElement>("[data-reference-checkbox]");
  const tracingSelect = container.querySelector<HTMLSelectElement>("[data-tracing-select]");
  const blankSelect = container.querySelector<HTMLSelectElement>("[data-blank-select]");
  const repetitionsSelect = container.querySelector<HTMLSelectElement>("[data-repetitions-select]");
  const status = container.querySelector<HTMLElement>("[data-worksheet-status]");
  const output = container.querySelector<HTMLElement>("[data-worksheet-output]");
  const provenance = container.querySelector<HTMLUListElement>("[data-worksheet-provenance]");
  const settingsLink = container.querySelector<HTMLInputElement>("[data-settings-link]");
  const downloadButton = container.querySelector<HTMLButtonElement>("[data-export-svg]");
  const pngDownloadButton = container.querySelector<HTMLButtonElement>("[data-export-png]");
  const pdfDownloadButton = container.querySelector<HTMLButtonElement>("[data-export-pdf]");
  const printButton = container.querySelector<HTMLButtonElement>("[data-print-sheet]");
  const copyButton = container.querySelector<HTMLButtonElement>("[data-copy-link]");
  const printRule = document.createElement("style");
  printRule.id = "worksheet-page-rule";
  document.head.append(printRule);

  if (!modelSelect || !textInput || !presetSelect || !paperSelect || !marginSelect || !rowHeightSelect || !guidesSelect || !referenceCheckbox || !tracingSelect || !blankSelect || !repetitionsSelect || !status || !output || !provenance || !settingsLink || !downloadButton || !pngDownloadButton || !pdfDownloadButton || !printButton || !copyButton) return;

  const copy = JSON.parse(container.dataset.messages ?? "{}") as WorksheetMessages;
  const modelIds = [...modelSelect.options].map((option) => option.value);
  const defaultModel = modelIds[0] ?? "";
  const readSettings = (): WorksheetSettings => normalizeWorksheetSettings({
    model: modelSelect.value,
    referenceKind: referenceKind.value,
    paper: paperSelect.value,
    marginMm: Number(marginSelect.value),
    rowHeightMm: Number(rowHeightSelect.value),
    guides: guidesSelect.value,
    text: textInput.value,
    referenceRow: referenceCheckbox.checked,
    tracingRows: Number(tracingSelect.value),
    blankRows: Number(blankSelect.value),
    repetitions: Number(repetitionsSelect.value),
  }, modelIds, defaultModel);

  const applySettings = (settings: WorksheetSettings) => {
    modelSelect.value = settings.model;
    referenceKind.value = settings.referenceKind ?? "vector";
    textInput.value = settings.text;
    presetSelect.value = "";
    paperSelect.value = settings.paper;
    marginSelect.value = String(settings.marginMm);
    rowHeightSelect.value = String(settings.rowHeightMm);
    guidesSelect.value = settings.guides;
    referenceCheckbox.checked = settings.referenceRow;
    tracingSelect.value = String(settings.tracingRows);
    blankSelect.value = String(settings.blankRows);
    repetitionsSelect.value = String(settings.repetitions);
  };

  let settings = decodeWorksheetSettings(location.hash, modelIds, defaultModel) ?? normalizeWorksheetSettings({}, modelIds, defaultModel);
  applySettings(settings);
  const indexUrl = container.dataset.indexUrl;
  if (!indexUrl) {
    status.textContent = copy.error;
    return;
  }

  let datasetVersion = "";
  let glyphEntries: GlyphIndexEntry[] = [];
  let sourceRecords: SourceRecord[] = [];
  let fontRecords: FontRecord[] = [];
  const fontCache = new Map<string, Promise<WorksheetFont>>();
  const glyphByKey = new Map<string, GlyphIndexEntry>();
  const sourceById = new Map<string, SourceRecord>();
  const glyphCache = new Map<string, Promise<GlyphRecord | null>>();
  let currentSvg: SVGSVGElement | null = null;
  let renderId = 0;

  const fetchLocalJson = async <T>(path: string): Promise<T> => {
    const url = new URL(path, location.href);
    if (url.origin !== location.origin) throw new Error("Worksheet data must stay same-origin.");
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Local worksheet data request failed: ${response.status}`);
    return await response.json() as T;
  };

  try {
    const index = await fetchLocalJson<ApiIndex>(indexUrl);
    datasetVersion = index.datasetVersion;
    [glyphEntries, sourceRecords, fontRecords] = await Promise.all([
      fetchLocalJson<GlyphIndexEntry[]>(index.glyphs),
      fetchLocalJson<SourceRecord[]>(index.sources),
      fetchLocalJson<FontRecord[]>(index.fonts),
    ]);
    for (const entry of glyphEntries) glyphByKey.set(`${entry.model}\u0000${entry.character}`, entry);
    for (const source of sourceRecords) sourceById.set(source.id, source);
  } catch {
    status.textContent = copy.error;
    return;
  }

  const loadGlyph = (modelId: string, character: string): Promise<GlyphRecord | null> => {
    const key = `${modelId}\u0000${character}`;
    if (!glyphCache.has(key)) {
      const entry = glyphByKey.get(key);
      glyphCache.set(key, entry ? fetchLocalJson<GlyphRecord>(entry.url).catch(() => null) : Promise.resolve(null));
    }
    return glyphCache.get(key)!;
  };

  const modelData = (): ModelWorksheetData | null => {
    const option = modelSelect.selectedOptions[0];
    if (!option) return null;
    let sources: string[] = [];
    try { sources = JSON.parse(option.dataset.sources ?? "[]") as string[]; } catch { sources = []; }
    return {
      id: option.value,
      name: option.textContent ?? option.value,
      license: option.dataset.license ?? "unknown",
      verification: option.dataset.verification ?? "draft",
      demo: option.dataset.demo === "true",
      direction: option.dataset.direction === "rtl" ? "rtl" : "ltr",
      sources,
      fontId: option.dataset.font ?? "",
      fontSupported: JSON.parse(option.dataset.supported ?? "[]") as string[],
    };
  };

  const loadFont = (fontId: string): Promise<WorksheetFont> => {
    if (!fontCache.has(fontId)) fontCache.set(fontId, (async () => {
      const record = fontRecords.find((font) => font.id === fontId);
      if (!record?.calibration || !record.file_urls?.[0]) throw new Error("No calibrated local reference font.");
      const url = new URL(record.file_urls[0], location.href);
      if (url.origin !== location.origin) throw new Error("Worksheet fonts must stay local.");
      const response = await fetch(url);
      if (!response.ok) throw new Error("Reference font unavailable.");
      const bytes = new Uint8Array(await response.arrayBuffer());
      let binary = "";
      for (const byte of bytes) binary += String.fromCharCode(byte);
      const dataUrl = `data:font/ttf;base64,${btoa(binary)}`;
      const family = `worksheet-${record.id}`;
      const face = await new FontFace(family, `url("${dataUrl}")`).load();
      document.fonts.add(face);
      if (!record.license_file_url) throw new Error("Font license unavailable.");
      const licenseUrl = new URL(record.license_file_url, location.href);
      if (licenseUrl.origin !== location.origin) throw new Error("Worksheet license must stay local.");
      const licenseResponse = await fetch(licenseUrl);
      if (!licenseResponse.ok) throw new Error("Font license unavailable.");
      const licenseText = await licenseResponse.text();
      return { record: record as WorksheetFont["record"], family, dataUrl, licenseText };
    })());
    return fontCache.get(fontId)!;
  };
  const localize = (template: string, values: Record<string, string>) => template.replace(/\{([A-Za-z]+)\}/g, (_match, key: string) => values[key] ?? "");
  const segmentText = (text: string) => [...new Intl.Segmenter(document.documentElement.lang, { granularity: "grapheme" }).segment(text)].map((item) => item.segment);

  const updateLink = (current: WorksheetSettings) => {
    const url = new URL(location.href);
    url.hash = encodeWorksheetSettings(current).slice(1);
    history.replaceState(null, "", url);
    settingsLink.value = url.href;
  };

  const render = async () => {
    const currentRender = ++renderId;
    settings = readSettings();
    textInput.value = settings.text;
    updateLink(settings);
    printRule.textContent = settings.paper === "A4" ? "@page { size: A4 portrait; margin: 0; }" : "@page { size: letter portrait; margin: 0; }";
    const model = modelData();
    if (!model) {
      status.textContent = copy.noModels;
      output.replaceChildren();
      provenance.replaceChildren();
      downloadButton.disabled = true;
      pngDownloadButton.disabled = true;
      pdfDownloadButton.disabled = true;
      printButton.disabled = true;
      return;
    }

    downloadButton.disabled = true;
    pngDownloadButton.disabled = true;
    pdfDownloadButton.disabled = true;
    printButton.disabled = true;
    currentSvg = null;
    status.textContent = copy.loading;
    const characters = [...new Set(segmentText(settings.text).filter((character) => !/^\s+$/u.test(character)))];
    let font: WorksheetFont | undefined;
    if (settings.referenceKind === "font") {
      if (!model.fontId || characters.some((character) => !model.fontSupported.includes(character))) {
        status.textContent = document.documentElement.lang === "de" ? "Referenzfont oder Zeichenabdeckung nicht verfügbar." : "Reference font or character coverage unavailable.";
        output.replaceChildren();
        provenance.replaceChildren();
        return;
      }
      try { font = await loadFont(model.fontId); }
      catch { if (currentRender === renderId) { status.textContent = copy.error; output.replaceChildren(); } return; }
    }
    const loadedGlyphs = await Promise.all(characters.map(async (character) => [character, await loadGlyph(model.id, character)] as const));
    if (currentRender !== renderId) return;
    const glyphByCharacter = new Map(loadedGlyphs);
    const supported = characters.filter((character) => Boolean(font || glyphByCharacter.get(character)?.outline));
    const missing = characters.filter((character) => !font && !glyphByCharacter.get(character)?.outline);
    const layout = layoutWorksheet(settings);
    const result = createWorksheetSvg(settings, layout, model, glyphByCharacter, characters, copy, datasetVersion, font);
    currentSvg = result.svg;
    output.replaceChildren(result.svg);
    updateProvenance(provenance, model, supported.map((character) => glyphByCharacter.get(character)!).filter(Boolean), sourceById, copy);
    if (font) {
      const item = document.createElement("li");
      item.textContent = `Reference font: ${font.record.name} · ${font.record.font_version} · ${font.record.license} · ${font.record.correspondence.degree}. Not official source traces or writing movement. ${font.record.sources.join(", ")}`;
      provenance.append(item);
    }
    downloadButton.disabled = false;
    printButton.disabled = false;
    pngDownloadButton.disabled = false;
    pdfDownloadButton.disabled = false;

    const messages: string[] = [];
    if (characters.length === 0) messages.push(localize(copy.ready, { supported: "0" }));
    else if (supported.length === 0) messages.push(copy.noOutlines);
    else if (missing.length > 0) messages.push(copy.missingOutlines);
    else messages.push(localize(copy.ready, { supported: String(supported.length) }));
    if (result.overflow) messages.push(copy.overflow);
    status.textContent = messages.join(" ");
  };

  const controls = container.querySelector<HTMLFormElement>("[data-worksheet-controls]");
  presetSelect.addEventListener("change", () => {
    const option = presetSelect.selectedOptions[0];
    if (!option?.dataset.model || option.dataset.text === undefined) return;
    modelSelect.value = option.dataset.model;
    textInput.value = option.dataset.text;
  });
  textInput.addEventListener("input", () => { presetSelect.value = ""; });
  modelSelect.addEventListener("change", () => {
    if (presetSelect.selectedOptions[0]?.dataset.model !== modelSelect.value) presetSelect.value = "";
  });
  controls?.addEventListener("input", () => void render());
  controls?.addEventListener("change", () => void render());
  window.addEventListener("hashchange", () => {
    const shared = decodeWorksheetSettings(location.hash, modelIds, defaultModel);
    if (shared) {
      applySettings(shared);
      void render();
    }
  });

  downloadButton.addEventListener("click", () => {
    if (!currentSvg) return;
    downloadBlob(new Blob([new XMLSerializer().serializeToString(currentSvg)], { type: "image/svg+xml;charset=utf-8" }), worksheetFilename(settings.model, "svg"));
  });
  pngDownloadButton.addEventListener("click", async () => {
    if (!currentSvg) return;
    try {
      const svg = currentSvg.cloneNode(true) as SVGSVGElement;
      const metadata = worksheetMetadata(svg);
      const { canvas } = await rasterizeWorksheet(svg);
      const png = await canvasBlob(canvas, "image/png");
      const withMetadata = appendWorksheetMetadataToPng(new Uint8Array(await png.arrayBuffer()), metadata);
      downloadBlob(new Blob([withMetadata.buffer as ArrayBuffer], { type: "image/png" }), worksheetFilename(settings.model, "png"));
    } catch {
      status.textContent = copy.exportError;
    }
  });
  pdfDownloadButton.addEventListener("click", async () => {
    if (!currentSvg) return;
    try {
      const svg = currentSvg.cloneNode(true) as SVGSVGElement;
      const metadata = worksheetMetadata(svg);
      const { canvas, widthMm, heightMm } = await rasterizeWorksheet(svg);
      const pdf = await createWorksheetPdf({
        pageWidthMm: widthMm,
        pageHeightMm: heightMm,
        pixelWidth: canvas.width,
        pixelHeight: canvas.height,
        rgb: canvasRgb(canvas),
        metadata,
      });
      downloadBlob(new Blob([pdf.buffer as ArrayBuffer], { type: "application/pdf" }), worksheetFilename(settings.model, "pdf"));
    } catch {
      status.textContent = copy.exportError;
    }
  });
  printButton.addEventListener("click", () => window.print());
  copyButton.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(settingsLink.value);
      status.textContent = copy.copyLinkSuccess;
    } catch {
      settingsLink.focus();
      settingsLink.select();
      status.textContent = copy.copyLinkError;
    }
  });

  await render();
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function worksheetFilename(modelId: string, extension: string): string {
  return `schreibatlas-worksheet-${modelId || "blank"}.${extension}`;
}

function worksheetMetadata(svg: SVGSVGElement): Record<string, unknown> {
  const text = svg.querySelector("metadata")?.textContent;
  if (!text) throw new Error("Worksheet metadata is missing.");
  return JSON.parse(text) as Record<string, unknown>;
}

async function rasterizeWorksheet(svg: SVGSVGElement): Promise<{ canvas: HTMLCanvasElement; widthMm: number; heightMm: number }> {
  const widthMm = Number(svg.getAttribute("width")?.replace(/mm$/, ""));
  const heightMm = Number(svg.getAttribute("height")?.replace(/mm$/, ""));
  if (!Number.isFinite(widthMm) || !Number.isFinite(heightMm)) throw new Error("Worksheet dimensions are invalid.");

  const svgBlob = new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml;charset=utf-8" });
  const svgUrl = URL.createObjectURL(svgBlob);
  const image = new Image();
  try {
    await new Promise<void>((resolve, reject) => {
      image.addEventListener("load", () => resolve(), { once: true });
      image.addEventListener("error", () => reject(new Error("Worksheet SVG could not be rasterized.")), { once: true });
      image.src = svgUrl;
    });
    const dpi = 240;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round((widthMm / 25.4) * dpi);
    canvas.height = Math.round((heightMm / 25.4) * dpi);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Worksheet canvas is unavailable.");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return { canvas, widthMm, heightMm };
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

function canvasBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Worksheet image export failed.")), type);
  });
}

function canvasRgb(canvas: HTMLCanvasElement): Uint8Array {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Worksheet canvas is unavailable.");
  const rgba = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const rgb = new Uint8Array((rgba.length / 4) * 3);
  for (let source = 0, target = 0; source < rgba.length; source += 4, target += 3) {
    rgb[target] = rgba[source];
    rgb[target + 1] = rgba[source + 1];
    rgb[target + 2] = rgba[source + 2];
  }
  return rgb;
}

function svgElement(name: string, attributes: Record<string, string> = {}): SVGElement {
  const element = document.createElementNS(svgNamespace, name);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
  return element;
}

function addSvgText(parent: SVGElement, text: string, attributes: Record<string, string>): SVGElement {
  const element = svgElement("text", attributes);
  element.textContent = text;
  parent.append(element);
  return element;
}

function createWorksheetSvg(
  settings: WorksheetSettings,
  layout: ReturnType<typeof layoutWorksheet>,
  model: ModelWorksheetData,
  glyphs: Map<string, GlyphRecord | null>,
  characters: string[],
  copy: WorksheetMessages,
  datasetVersion: string,
  font?: WorksheetFont,
): { svg: SVGSVGElement; overflow: boolean } {
  const svg = svgElement("svg", {
    xmlns: svgNamespace,
    width: `${layout.width}mm`,
    height: `${layout.height}mm`,
    viewBox: `0 0 ${layout.width} ${layout.height}`,
    role: "img",
    "aria-label": copy.svgTitle,
    lang: document.documentElement.lang,
    "data-settings": encodeWorksheetSettings(settings),
  }) as SVGSVGElement;
  const title = svgElement("title");
  title.textContent = copy.svgTitle;
  svg.append(title);
  if (font) {
    const defs = svgElement("defs");
    const style = svgElement("style");
    style.textContent = `@font-face { font-family: "${font.family}"; src: url("${font.dataUrl}") format("truetype"); font-weight: 400; font-style: normal; }`;
    defs.append(style);
    svg.append(defs);
  }
  const description = svgElement("desc");
  description.textContent = copy.textPromptNote;
  svg.append(description);

  const supportedGlyphs = characters.flatMap((character) => {
    const glyph = glyphs.get(character);
    return glyph?.outline ? [{ character, glyph }] : [];
  });
  const missingGlyphs = characters.filter((character) => !font && !glyphs.get(character)?.outline);
  const markerPositions = worksheetMarkerLayout(layout.width, layout.height);
  const markerId = worksheetId(settings, datasetVersion);
  const metadata = {
    schemaVersion: 1,
    kind: "schreibatlas-worksheet",
    datasetVersion,
    referenceKind: font ? "font" : "vector",
    fontId: font?.record.id ?? null,
    fontVersion: font?.record.font_version ?? null,
    fontLicense: font?.record.license ?? null,
    fontSources: font?.record.sources ?? [],
    fontLicenseText: font?.licenseText ?? null,
    fontIntegrity: font?.record.integrity ?? null,
    shaping: font?.record.shaping ?? null,
    settings,
    worksheetId: markerId,
    worksheetMarker: { ...worksheetMarker, pageWidthMm: layout.width, pageHeightMm: layout.height, positionsMm: markerPositions },
    writingRegionMm: {
      left: settings.marginMm + 14,
      right: layout.width - settings.marginMm,
      blankRows: layout.rows.filter((row) => row.kind === "blank").map((row) => ({
        id: `${row.repetition}.${row.number}`,
        top: row.top,
        baseline: row.baseline,
        xHeight: row.xHeight,
        height: settings.rowHeightMm,
      })),
    },
    settingsFragment: encodeWorksheetSettings(settings),
    model,
    rowLayout: layout.rows,
    outlines: (font ? [] : supportedGlyphs).map(({ character, glyph }) => ({ character, unicode: glyph.unicode, verification: glyph.verification, license: glyph.license, sources: glyph.sources })),
    missingGlyphs,
  };
  const metadataNode = svgElement("metadata");
  metadataNode.textContent = JSON.stringify(metadata);
  svg.append(metadataNode);
  svg.append(svgElement("rect", { x: "0", y: "0", width: String(layout.width), height: String(layout.height), fill: "white" }));
  const markerSize = worksheetMarker.sizeMm;
  const markerBorder = markerSize * 0.14;
  const markerInner = markerSize - markerBorder * 2;
  for (const marker of markerPositions) {
    const x = marker.x - markerSize / 2;
    const y = marker.y - markerSize / 2;
    const group = svgElement("g", { "data-worksheet-marker": worksheetMarker.format, "data-marker-code": String(marker.code), "data-marker-corner": marker.corner, "data-worksheet-id": markerId });
    group.append(svgElement("rect", { x: String(x), y: String(y), width: String(markerSize), height: String(markerSize), fill: "#000" }));
    group.append(svgElement("rect", { x: String(x + markerBorder), y: String(y + markerBorder), width: String(markerInner), height: String(markerInner), fill: "#fff" }));
    const moduleGap = markerInner * 0.08;
    const cellSize = markerInner / 2;
    for (let index = 0; index < marker.code; index += 1) {
      const column = index % 2;
      const row = Math.floor(index / 2);
      group.append(svgElement("rect", {
        x: String(x + markerBorder + column * cellSize + moduleGap / 2),
        y: String(y + markerBorder + row * cellSize + moduleGap / 2),
        width: String(cellSize - moduleGap),
        height: String(cellSize - moduleGap),
        fill: "#000",
      }));
    }
    svg.append(group);
  }

  const margin = settings.marginMm;
  addSvgText(svg, copy.svgTitle, { x: String(margin), y: String(margin + 5), "font-size": "5", "font-weight": "700" });
  addSvgText(svg, `${copy.modelLabel}: ${model.name}${model.demo ? " · demo" : ""}`, { x: String(margin), y: String(margin + 10), "font-size": "3.5" });
  addSvgText(svg, `${copy.promptPrefix}: ${settings.text}`, { x: String(margin), y: String(margin + 15), "font-size": "3.5", direction: model.direction, "unicode-bidi": "plaintext" });

  if (font) addSvgText(svg, `Reference font: ${font.record.name} ${font.record.font_version} · ${font.record.license} · not movement evidence`, { x: String(margin + 14), y: String(layout.height - margin - 2), "font-size": "2.5" });
  const world = svgElement("g", { transform: `translate(0 ${layout.height}) scale(1 -1)` });
  const rightEdge = layout.width - margin;
  const writingLeft = margin + 14;
  const guideRight = rightEdge;
  let overflow = false;

  for (const row of layout.rows) {
    const rowKind = settings.text ? row.kind : "blank";
    const rowLabel = rowKind === "reference" ? copy.reference : rowKind === "trace" ? copy.trace : copy.blank;
    const rowPrefix = rowKind === "reference" ? String(row.repetition) : `${row.repetition}.${row.number}`;
    addSvgText(svg, `${rowPrefix}. ${rowLabel}`, { x: String(margin), y: String(row.baseline - 1), "font-size": "2.8" });

    if (settings.guides !== "none") {
      const baselineY = layout.height - row.baseline;
      world.append(svgElement("line", {
        x1: String(margin + 12), x2: String(guideRight), y1: String(baselineY), y2: String(baselineY),
        stroke: "#526170", "stroke-width": "0.22", "data-guide": "baseline",
      }));
      if (settings.guides === "baseline-xheight") {
        const xHeightY = layout.height - row.xHeight;
        world.append(svgElement("line", {
          x1: String(margin + 12), x2: String(guideRight), y1: String(xHeightY), y2: String(xHeightY),
          stroke: "#8b9aa8", "stroke-width": "0.16", "stroke-dasharray": "1.2 0.8", "data-guide": "x-height",
        }));
      }
    }

    if (rowKind !== "reference" && rowKind !== "trace") continue;
    const xHeightMm = settings.rowHeightMm * 0.4;
    const baselineWorld = layout.height - row.baseline;
    if (font) {
      const fontSize = xHeightMm / font.record.calibration.x_height_em;
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d")!;
      context.font = `${fontSize}px "${font.family}"`;
      const width = context.measureText(settings.text).width;
      if (width > rightEdge - writingLeft) { overflow = true; continue; }
      const text = addSvgText(svg, settings.text, {
        x: String(model.direction === "rtl" ? rightEdge : writingLeft), y: String(row.baseline),
        "font-family": font.family, "font-size": String(fontSize), direction: model.direction,
        "text-anchor": model.direction === "rtl" ? "end" : "start",
        opacity: rowKind === "reference" ? "0.68" : "0.22", "data-reference-kind": "font", "data-row-kind": rowKind,
      });
      text.style.fontFeatureSettings = (font.record.shaping?.required_features ?? ["calt", "kern"]).map((tag) => `"${tag}" 1`).join(", ");
      continue;
    }
    let cursorX = model.direction === "rtl" ? rightEdge : writingLeft;
    for (const character of segmentTextForWorksheet(settings.text)) {
      if (/^\s+$/u.test(character)) {
        cursorX += model.direction === "rtl" ? -xHeightMm * 0.35 : xHeightMm * 0.35;
        continue;
      }
      const glyph = glyphs.get(character);
      if (!glyph?.outline) {
        cursorX += model.direction === "rtl" ? -xHeightMm * 0.35 : xHeightMm * 0.35;
        continue;
      }
      const normalized = normalizeOutline(glyph.outline);
      const glyphWidth = (normalized.bounds.maxX - normalized.bounds.minX) * xHeightMm;
      const positionX = model.direction === "rtl" ? cursorX - glyphWidth : cursorX;
      if (positionX < writingLeft || positionX + glyphWidth > rightEdge) {
        overflow = true;
        break;
      }
      const group = svgElement("g", {
        transform: `translate(${positionX} ${baselineWorld}) scale(${xHeightMm}) ${normalized.transform}`,
        opacity: rowKind === "reference" ? "0.68" : "0.22",
        "data-character": character,
        "data-row-kind": rowKind,
      });
      group.append(svgElement("path", { d: glyph.outline.path, fill: "#1d1d1b", "fill-rule": glyph.outline.fill_rule ?? "nonzero" }));
      world.append(group);
      cursorX += model.direction === "rtl" ? -(glyphWidth + xHeightMm * 0.18) : glyphWidth + xHeightMm * 0.18;
    }
  }

  svg.append(world);
  const legend = svgElement("text", { x: String(margin + 14), y: String(layout.height - margin / 2), "font-size": "2.8" });
  legend.textContent = copy.guideLegend;
  svg.append(legend);
  addSvgText(svg, markerId, { x: String(layout.width - margin - 32), y: String(layout.height - margin / 2), "font-size": "2.5", "text-anchor": "end" });
  return { svg, overflow };
}

function segmentTextForWorksheet(text: string): string[] {
  return [...new Intl.Segmenter(document.documentElement.lang, { granularity: "grapheme" }).segment(text)].map((item) => item.segment);
}

function updateProvenance(
  list: HTMLUListElement,
  model: ModelWorksheetData,
  glyphs: GlyphRecord[],
  sourcesById: Map<string, SourceRecord>,
  copy: WorksheetMessages,
): void {
  list.replaceChildren();
  const records = [
    { label: model.name, license: model.license, verification: model.verification, sources: model.sources },
    ...glyphs.map((glyph) => ({ label: glyph.character, license: glyph.license, verification: glyph.verification, sources: glyph.sources })),
  ];
  for (const record of records) {
    const item = document.createElement("li");
    const status = copy.verification[record.verification]?.label ?? record.verification;
    const sourceText = record.sources.map((id) => {
      const source = sourcesById.get(id);
      return source ? `${source.title} (${source.author.join(", ")})` : id;
    }).join("; ") || "unknown";
    item.textContent = `${record.label}: ${localizeSourceCredits(copy.sourceCredits, sourceText, record.license, status)}`;
    list.append(item);
  }
}

function localizeSourceCredits(template: string, sources: string, license: string, status: string): string {
  return template.replace("{sources}", sources).replace("{license}", license).replace("{status}", status);
}

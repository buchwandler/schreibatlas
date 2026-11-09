import { normalizeOutline } from "../../tools/geometry.mjs";
import { decodeWorksheetSettings, encodeWorksheetSettings, layoutWorksheet, normalizeWorksheetSettings, worksheetId, worksheetMarker, worksheetMarkerLayout } from "../../tools/worksheet.mjs";
import type { GlyphRecord, SourceRecord } from "../../tools/content.mjs";
import type { WorksheetSettings } from "../../tools/worksheet.mjs";

const svgNamespace = "http://www.w3.org/2000/svg";

interface ApiIndex {
  datasetVersion: string;
  glyphs: string;
  sources: string;
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
}

const root = document.querySelector<HTMLElement>("[data-worksheet]");
if (root) initializeWorksheet(root);

async function initializeWorksheet(container: HTMLElement): Promise<void> {
  const modelSelect = container.querySelector<HTMLSelectElement>("[data-model-select]");
  const textInput = container.querySelector<HTMLInputElement>("[data-text-input]");
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
  const printButton = container.querySelector<HTMLButtonElement>("[data-print-sheet]");
  const copyButton = container.querySelector<HTMLButtonElement>("[data-copy-link]");
  const printRule = document.createElement("style");
  printRule.id = "worksheet-page-rule";
  document.head.append(printRule);

  if (!modelSelect || !textInput || !paperSelect || !marginSelect || !rowHeightSelect || !guidesSelect || !referenceCheckbox || !tracingSelect || !blankSelect || !repetitionsSelect || !status || !output || !provenance || !settingsLink || !downloadButton || !printButton || !copyButton) return;

  const copy = JSON.parse(container.dataset.messages ?? "{}") as WorksheetMessages;
  const modelIds = [...modelSelect.options].map((option) => option.value);
  const defaultModel = modelIds[0] ?? "";
  const readSettings = (): WorksheetSettings => normalizeWorksheetSettings({
    model: modelSelect.value,
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
    textInput.value = settings.text;
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
    [glyphEntries, sourceRecords] = await Promise.all([
      fetchLocalJson<GlyphIndexEntry[]>(index.glyphs),
      fetchLocalJson<SourceRecord[]>(index.sources),
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
    };
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
      printButton.disabled = true;
      return;
    }

    downloadButton.disabled = true;
    printButton.disabled = true;
    currentSvg = null;
    status.textContent = copy.loading;
    const characters = [...new Set(segmentText(settings.text).filter((character) => !/^\s+$/u.test(character)))];
    const loadedGlyphs = await Promise.all(characters.map(async (character) => [character, await loadGlyph(model.id, character)] as const));
    if (currentRender !== renderId) return;
    const glyphByCharacter = new Map(loadedGlyphs);
    const supported = characters.filter((character) => Boolean(glyphByCharacter.get(character)?.outline));
    const missing = characters.filter((character) => !glyphByCharacter.get(character)?.outline);
    const layout = layoutWorksheet(settings);
    const result = createWorksheetSvg(settings, layout, model, glyphByCharacter, characters, copy, datasetVersion);
    currentSvg = result.svg;
    output.replaceChildren(result.svg);
    updateProvenance(provenance, model, supported.map((character) => glyphByCharacter.get(character)!).filter(Boolean), sourceById, copy);
    downloadButton.disabled = false;
    printButton.disabled = false;

    const messages: string[] = [];
    if (characters.length === 0) messages.push(localize(copy.ready, { supported: "0" }));
    else if (supported.length === 0) messages.push(copy.noOutlines);
    else if (missing.length > 0) messages.push(copy.missingOutlines);
    else messages.push(localize(copy.ready, { supported: String(supported.length) }));
    if (result.overflow) messages.push(copy.overflow);
    status.textContent = messages.join(" ");
  };

  const controls = container.querySelector<HTMLFormElement>("[data-worksheet-controls]");
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
    const file = new Blob([new XMLSerializer().serializeToString(currentSvg)], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = `schreibatlas-worksheet-${settings.model || "blank"}.svg`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
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
  const description = svgElement("desc");
  description.textContent = copy.textPromptNote;
  svg.append(description);

  const supportedGlyphs = characters.flatMap((character) => {
    const glyph = glyphs.get(character);
    return glyph?.outline ? [{ character, glyph }] : [];
  });
  const missingGlyphs = characters.filter((character) => !glyphs.get(character)?.outline);
  const markerPositions = worksheetMarkerLayout(layout.width, layout.height);
  const markerId = worksheetId(settings, datasetVersion);
  const metadata = {
    schemaVersion: 1,
    kind: "schreibatlas-worksheet",
    datasetVersion,
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
    outlines: supportedGlyphs.map(({ character, glyph }) => ({ character, unicode: glyph.unicode, verification: glyph.verification, license: glyph.license, sources: glyph.sources })),
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

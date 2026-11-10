// SPDX-License-Identifier: Apache-2.0
import { normalizeOutline } from "../../tools/geometry.mjs";
import { compareVerifiedStrokes } from "../../tools/stroke-comparison.mjs";
import type { MovementComparisonResult } from "../../tools/stroke-comparison.mjs";
import { measureCapture, splitCaptureStrokes, type WritingSample } from "../../tools/writing-capture.mjs";
import type { GlyphRecord, SourceRecord, StrokeRecord } from "../../tools/content.mjs";

const svgNamespace = "http://www.w3.org/2000/svg";

interface ApiIndex {
  datasetVersion: string;
  glyphs: string;
  sources: string;
  strokes: string;
}

interface GlyphIndexEntry {
  model: string;
  character: string;
  url: string;
}

interface StrokeIndexEntry {
  model: string;
  character: string;
  verification: string;
  url: string;
}

interface WritingMessages {
  statusLoading: string;
  statusReady: string;
  statusCaptured: string;
  statusError: string;
  statusInvalidCharacter: string;
  statusReferenceLoading: string;
  statusReferenceReady: string;
  statusNoReference: string;
  metricStrokes: string;
  metricSamples: string;
  metricPathLength: string;
  metricWidth: string;
  metricHeight: string;
  metricDuration: string;
  metricPressureSamples: string;
  metricNoPressure: string;
  writeProvenance: string;
  writeProvenanceEmpty: string;
  writeMovementTitle: string;
  writeMovementNote: string;
  writeMovementCompare: string;
  writeMovementLoading: string;
  writeMovementUnavailable: string;
  writeMovementNoCapture: string;
  writeMovementReferenceReady: string;
  writeMovementError: string;
  writeMovementResultReady: string;
  writeMovementComplete: string;
  writeMovementStart: string;
  writeMovementDirection: string;
  writeMovementOrder: string;
  writeMovementPenLifts: string;
  writeMovementRhythm: string;
  writeMovementSources: string;
  writeMovementConfidence: string;
  writeMovementMatch: string;
  writeMovementDifferent: string;
  writeMovementUncertain: string;
  writeMovementUnavailableState: string;
}

interface ModelSelection {
  id: string;
  demo: boolean;
  verification: string;
}

const page = document.querySelector<HTMLElement>("[data-writing-page]");
if (page) initializeWritingCapture(page);

async function initializeWritingCapture(container: HTMLElement): Promise<void> {
  const form = container.querySelector<HTMLFormElement>("[data-writing-controls]");
  const modelSelect = container.querySelector<HTMLSelectElement>("[data-writing-model]");
  const characterInput = container.querySelector<HTMLInputElement>("[data-writing-character]");
  const referenceCheckbox = container.querySelector<HTMLInputElement>("[data-writing-reference-toggle]");
  const opacityInput = container.querySelector<HTMLInputElement>("[data-writing-opacity]");
  const surface = container.querySelector<SVGSVGElement>("[data-writing-surface]");
  const referenceLayer = container.querySelector<SVGGElement>("[data-writing-reference-layer]");
  const captureLayer = container.querySelector<SVGGElement>("[data-writing-capture]");
  const keyboardCursor = container.querySelector<SVGCircleElement>("[data-writing-cursor]");
  const status = container.querySelector<HTMLElement>("[data-writing-status]");
  const clearButton = container.querySelector<HTMLButtonElement>("[data-writing-clear]");
  const exportJsonButton = container.querySelector<HTMLButtonElement>("[data-writing-export-json]");
  const exportSvgButton = container.querySelector<HTMLButtonElement>("[data-writing-export-svg]");
  const movementCompareButton = container.querySelector<HTMLButtonElement>("[data-movement-compare]");
  const movementStatus = container.querySelector<HTMLElement>("[data-movement-status]");
  const movementSources = container.querySelector<HTMLUListElement>("[data-movement-sources]");
  const movementSourcesTitle = container.querySelector<HTMLElement>("[data-movement-sources-title]");
  const movementResults = container.querySelector<HTMLDListElement>("[data-movement-results]");
  const movementResultNote = container.querySelector<HTMLElement>("[data-movement-result-note]");
  const movementResultElements = new Map([...container.querySelectorAll<HTMLElement>("[data-movement-result]")].map((element) => [element.dataset.movementResult ?? "", element]));
  const provenance = container.querySelector<HTMLUListElement>("[data-writing-provenance]");
  const pressureStatus = container.querySelector<HTMLElement>("[data-writing-pressure-status]");
  const metricElements = [...container.querySelectorAll<HTMLElement>("[data-metric]")];
  if (
    !form || !modelSelect || !characterInput || !referenceCheckbox || !opacityInput || !surface || !referenceLayer || !captureLayer
    || !keyboardCursor || !status || !clearButton || !exportJsonButton || !exportSvgButton || !provenance || !pressureStatus
    || !movementCompareButton || !movementStatus || !movementSources || !movementResults || !movementResultNote || movementResultElements.size !== 5
  ) return;

  const copy = JSON.parse(container.dataset.messages ?? "{}") as WritingMessages;
  const samples: WritingSample[] = [];
  const glyphCache = new Map<string, Promise<GlyphRecord | null>>();
  const sourceById = new Map<string, SourceRecord>();
  const strokeCache = new Map<string, Promise<StrokeRecord | null>>();
  let strokeIndex: StrokeIndexEntry[] = [];
  let referenceStrokeRecord: StrokeRecord | null = null;
  let referenceMovementPaths = new Map<number, { x: number; y: number }[]>();
  let movementComparison: MovementComparisonResult | null = null;
  let movementReferenceVersion = 0;
  let glyphIndex: GlyphIndexEntry[] = [];
  let datasetVersion = "";
  let localDataAvailable = false;
  let referenceGlyph: GlyphRecord | null = null;
  let referenceVersion = 0;
  let captureStartedAt: number | null = null;
  let activePointerId: number | null = null;
  let keyboardDrawing = false;
  let keyboardCursorPosition = { x: 500, y: 300 };

  const localJson = async <T>(path: string): Promise<T> => {
    const url = new URL(path, location.href);
    if (url.origin !== location.origin) throw new Error("Writing capture data must stay same-origin.");
    const response = await fetch(url, { credentials: "same-origin" });
    if (!response.ok) throw new Error(`Local writing data request failed: ${response.status}`);
    return await response.json() as T;
  };

  const selectedModel = (): ModelSelection | null => {
    const option = modelSelect.selectedOptions[0];
    if (!option) return null;
    return {
      id: option.value,
      demo: option.dataset.demo === "true",
      verification: option.dataset.verification ?? "draft",
    };
  };

  const oneGrapheme = (value: string): string | null => {
    const segments = [...new Intl.Segmenter(document.documentElement.lang, { granularity: "grapheme" }).segment(value.trim())];
    return segments.length === 1 ? segments[0].segment : null;
  };

  const svgElement = (name: string, attributes: Record<string, string> = {}) => {
    const element = document.createElementNS(svgNamespace, name);
    for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
    return element;
  };

  const localize = (template: string, values: Record<string, string>) => template.replace(/\{([A-Za-z]+)\}/g, (_match, key: string) => values[key] ?? "");

  const renderProvenance = (glyph: GlyphRecord | null) => {
    provenance.replaceChildren();
    if (!glyph) {
      referenceGlyph = null;
      const item = document.createElement("li");
      item.textContent = copy.writeProvenanceEmpty;
      provenance.append(item);
      return;
    }
    for (const sourceId of glyph.sources) {
      const source = sourceById.get(sourceId);
      if (!source) continue;
      const item = document.createElement("li");
      const author = source.author.length ? ` · ${source.author.join(", ")}` : "";
      const license = source.rights.license ?? glyph.license;
      item.textContent = `${source.title}${author} · ${license}`;
      provenance.append(item);
    }
    referenceGlyph = glyph;
  };

  const updateReference = async () => {
    const version = ++referenceVersion;
    referenceLayer.replaceChildren();
    renderProvenance(null);
    if (!referenceCheckbox.checked) {
      if (!samples.length) status.textContent = localDataAvailable ? copy.statusReady : copy.statusError;
      return;
    }

    const character = oneGrapheme(characterInput.value);
    if (!character || /^\s+$/u.test(character)) {
      status.textContent = copy.statusInvalidCharacter;
      return;
    }
    const model = selectedModel();
    if (!model || model.demo || !["source-backed", "reviewed", "verified"].includes(model.verification)) {
      status.textContent = copy.statusNoReference;
      return;
    }

    status.textContent = copy.statusReferenceLoading;
    const entry = glyphIndex.find((item) => item.model === model.id && item.character === character);
    if (!entry) {
      status.textContent = copy.statusNoReference;
      return;
    }

    const key = `${entry.model}\u0000${entry.character}`;
    if (!glyphCache.has(key)) glyphCache.set(key, localJson<GlyphRecord>(entry.url).catch(() => null));
    const glyph = await glyphCache.get(key)!;
    if (version !== referenceVersion) return;
    if (!glyph || !glyph.outline || !glyph.sources.length || !["source-backed", "reviewed", "verified"].includes(glyph.verification)) {
      status.textContent = copy.statusNoReference;
      return;
    }

    const geometry = normalizeOutline(glyph.outline);
    const width = geometry.bounds.maxX - geometry.bounds.minX;
    const height = geometry.bounds.maxY - geometry.bounds.minY;
    const scale = Math.min(360 / Math.max(height, 0.01), 520 / Math.max(width, 0.01));
    const centerX = 500 - ((geometry.bounds.minX + geometry.bounds.maxX) / 2) * scale;
    const top = (600 - height * scale) / 2;
    const baselineY = top + geometry.bounds.maxY * scale;
    const path = svgElement("path", {
      d: glyph.outline.path,
      transform: `translate(${centerX} ${baselineY}) scale(${scale} ${-scale}) ${geometry.transform}`,
      fill: "#315c79",
      "fill-rule": glyph.outline.fill_rule ?? "nonzero",
      "fill-opacity": opacityInput.value,
      "data-reference-character": glyph.character,
    });
    referenceLayer.append(path);
    renderProvenance(glyph);
    status.textContent = copy.statusReferenceReady;
  };


  const clearMovementReference = (message: string) => {
    referenceStrokeRecord = null;
    referenceMovementPaths = new Map();
    movementComparison = null;
    movementCompareButton.disabled = true;
    movementSources.replaceChildren();
    movementSources.hidden = true;
    movementResults.hidden = true;
    if (movementSourcesTitle) movementSourcesTitle.hidden = true;
    movementResultNote.hidden = true;
    movementStatus.textContent = message;
  };

  const renderMovementComparison = (result: MovementComparisonResult) => {
    const labels: Record<string, string> = {
      start: copy.writeMovementStart,
      direction: copy.writeMovementDirection,
      order: copy.writeMovementOrder,
      penLifts: copy.writeMovementPenLifts,
      rhythm: copy.writeMovementRhythm,
    };
    const states: Record<string, string> = {
      match: copy.writeMovementMatch,
      different: copy.writeMovementDifferent,
      uncertain: copy.writeMovementUncertain,
      unavailable: copy.writeMovementUnavailableState,
    };
    for (const [name, element] of movementResultElements) {
      const observation = result.observations[name as keyof MovementComparisonResult["observations"]];
      if (!observation) continue;
      element.dataset.status = observation.status;
      const confidence = observation.confidence === null ? "" : ` · ${copy.writeMovementConfidence} ${Math.round(observation.confidence * 100)}%`;
      element.textContent = `${states[observation.status]}${confidence}`;
      element.setAttribute("aria-label", `${labels[name]}: ${element.textContent}`);
    }
    movementResults.hidden = false;
    movementResultNote.hidden = false;
    movementStatus.textContent = result.available ? copy.writeMovementComplete : copy.writeMovementUnavailable;
  };

  const updateMovementReference = async () => {
    const version = ++movementReferenceVersion;
    clearMovementReference(copy.writeMovementLoading);
    const character = oneGrapheme(characterInput.value);
    const model = selectedModel();
    if (!localDataAvailable || !character || !model || model.demo) {
      clearMovementReference(copy.writeMovementUnavailable);
      return;
    }
    const entry = strokeIndex.find((item) => item.model === model.id && item.character === character);
    if (!entry || entry.verification !== "verified") {
      clearMovementReference(copy.writeMovementUnavailable);
      return;
    }

    try {
      if (!strokeCache.has(entry.url)) strokeCache.set(entry.url, localJson<StrokeRecord>(entry.url).catch(() => null));
      const record = await strokeCache.get(entry.url)!;
      if (version !== movementReferenceVersion) return;
      if (!record || record.model !== model.id || record.character !== character || record.verification !== "verified"
        || record.sources.length === 0 || record.sources.some((sourceId) => !sourceById.has(sourceId))) {
        clearMovementReference(copy.writeMovementUnavailable);
        return;
      }
      const orderedStrokes = [...record.strokes].sort((left, right) => left.order - right.order);
      const downStrokes = orderedStrokes.filter((stroke) => stroke.pen_down);
      if (!downStrokes.length) {
        clearMovementReference(copy.writeMovementUnavailable);
        return;
      }
      const pathEntries = await Promise.all(downStrokes.map(async (stroke) => {
        if (!stroke.file_url) throw new Error("Verified stroke data has no local geometry URL.");
        return [stroke.order, await sampleStrokeAsset(stroke.file_url)] as const;
      }));
      if (version !== movementReferenceVersion) return;

      referenceStrokeRecord = record;
      referenceMovementPaths = new Map(pathEntries);
      movementSources.replaceChildren();
      for (const sourceId of record.sources) {
        const source = sourceById.get(sourceId)!;
        const author = source.author.length ? ` · ${source.author.join(", ")}` : "";
        const item = document.createElement("li");
        item.textContent = `${source.title}${author} · ${source.rights.license ?? record.license}`;
        movementSources.append(item);
      }
      movementSources.hidden = false;
      if (movementSourcesTitle) movementSourcesTitle.hidden = false;
      movementCompareButton.disabled = samples.length === 0;
      movementStatus.textContent = samples.length ? copy.writeMovementReferenceReady : copy.writeMovementNoCapture;
    } catch {
      if (version === movementReferenceVersion) clearMovementReference(copy.writeMovementError);
    }
  };
  const renderCapture = () => {
    captureLayer.replaceChildren();
    for (const stroke of splitCaptureStrokes(samples)) {
      if (stroke.length === 1) {
        const point = stroke[0];
        captureLayer.append(svgElement("circle", {
          cx: String(point.x),
          cy: String(point.y),
          r: "6",
          fill: "#0d3d68",
          "data-captured-stroke": "true",
        }));
        continue;
      }
      const pathData = stroke.map(({ x, y }, index) => `${index === 0 ? "M" : "L"}${x} ${y}`).join(" ");
      captureLayer.append(svgElement("path", {
        d: pathData,
        fill: "none",
        stroke: "#0d3d68",
        "stroke-width": "12",
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
        "data-captured-stroke": "true",
      }));
    }

    const metrics = measureCapture(samples);
    const formatter = new Intl.NumberFormat(document.documentElement.lang, { maximumFractionDigits: 1 });
    const values: Record<string, number> = {
      strokeCount: metrics.strokeCount,
      sampleCount: metrics.sampleCount,
      pathLength: metrics.pathLength,
      width: metrics.width,
      height: metrics.height,
      durationMs: metrics.durationMs,
      pressureSampleCount: metrics.pressureSampleCount,
    };
    for (const element of metricElements) {
      const key = element.dataset.metric ?? "";
      if (key in values) {
        element.dataset.value = String(values[key]);
        element.textContent = formatter.format(values[key]);
      }
    }
    pressureStatus.textContent = metrics.pressureSampleCount ? "" : copy.metricNoPressure;
    clearButton.disabled = samples.length === 0;
    exportJsonButton.disabled = samples.length === 0;
    exportSvgButton.disabled = samples.length === 0;
    movementComparison = null;
    movementResults.hidden = true;
    movementResultNote.hidden = true;
    movementCompareButton.disabled = !referenceStrokeRecord || samples.length === 0;
    movementStatus.textContent = referenceStrokeRecord
      ? (samples.length ? copy.writeMovementReferenceReady : copy.writeMovementNoCapture)
      : copy.writeMovementUnavailable;
    if (samples.length) status.textContent = localize(copy.statusCaptured, { strokes: String(metrics.strokeCount), samples: String(metrics.sampleCount) });
  };

  movementCompareButton.addEventListener("click", () => {
    if (!referenceStrokeRecord || !samples.length) return;
    const capturedStrokes = splitCaptureStrokes(samples).map((stroke) => stroke.map((point) => ({ x: point.x / 600, y: point.y / 600, t: point.t })));
    const reference = {
      verification: referenceStrokeRecord.verification,
      sources: referenceStrokeRecord.sources,
      strokes: [...referenceStrokeRecord.strokes].sort((left, right) => left.order - right.order).map((stroke) => ({
        penDown: stroke.pen_down,
        points: stroke.pen_down ? referenceMovementPaths.get(stroke.order) ?? [] : [],
        timingMs: stroke.timing_ms ?? null,
      })),
    };
    movementComparison = compareVerifiedStrokes(reference, capturedStrokes);
    renderMovementComparison(movementComparison);
  });

  const sample = (x: number, y: number, time: number, pointerType: string, penDown: boolean, pressure?: number) => {
    if (penDown && captureStartedAt === null) captureStartedAt = time;
    const recorded: WritingSample = {
      x: Math.round(x * 100) / 100,
      y: Math.round(y * 100) / 100,
      t: Math.max(0, Math.round(time - (captureStartedAt ?? time))),
      pointerType,
      penDown,
    };
    if (penDown && Number.isFinite(pressure) && pressure! > 0) recorded.pressure = pressure;
    samples.push(recorded);
  };

  const eventCoordinates = (event: PointerEvent) => {
    const matrix = surface.getScreenCTM();
    if (!matrix) return { x: 0, y: 0 };
    const point = surface.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const local = point.matrixTransform(matrix.inverse());
    return { x: Math.max(0, Math.min(1000, local.x)), y: Math.max(0, Math.min(600, local.y)) };
  };

  const updateCursor = (x: number, y: number) => {
    keyboardCursorPosition = { x, y };
    keyboardCursor.setAttribute("cx", String(x));
    keyboardCursor.setAttribute("cy", String(y));
  };

  const finishKeyboardStroke = () => {
    if (!keyboardDrawing) return;
    keyboardDrawing = false;
    sample(keyboardCursorPosition.x, keyboardCursorPosition.y, performance.now(), "keyboard", false);
    renderCapture();
  };

  const capturePointer = (event: PointerEvent, penDown: boolean) => {
    const point = eventCoordinates(event);
    updateCursor(point.x, point.y);
    const pressure = event.pointerType === "pen" && penDown && Number.isFinite(event.pressure) ? event.pressure : undefined;
    sample(point.x, point.y, event.timeStamp, event.pointerType || "unknown", penDown, pressure);
  };

  surface.addEventListener("pointerdown", (event) => {
    if (activePointerId !== null) return;
    event.preventDefault();
    finishKeyboardStroke();
    activePointerId = event.pointerId;
    surface.setPointerCapture(event.pointerId);
    capturePointer(event, true);
    renderCapture();
  });

  surface.addEventListener("pointermove", (event) => {
    if (event.pointerId !== activePointerId) return;
    const coalesced = event.getCoalescedEvents?.() ?? [];
    for (const point of coalesced.length ? coalesced : [event]) capturePointer(point, true);
    renderCapture();
  });

  const finishPointer = (event: PointerEvent) => {
    if (event.pointerId !== activePointerId) return;
    capturePointer(event, false);
    activePointerId = null;
    renderCapture();
  };
  surface.addEventListener("pointerup", finishPointer);
  surface.addEventListener("pointercancel", finishPointer);
  surface.addEventListener("lostpointercapture", finishPointer);

  surface.addEventListener("keydown", (event) => {
    const step = event.shiftKey ? 24 : 8;
    const moves: Record<string, { x: number; y: number }> = {
      ArrowLeft: { x: -step, y: 0 },
      ArrowRight: { x: step, y: 0 },
      ArrowUp: { x: 0, y: -step },
      ArrowDown: { x: 0, y: step },
    };
    const movement = moves[event.key];
    if (movement) {
      event.preventDefault();
      const x = Math.max(0, Math.min(1000, keyboardCursorPosition.x + movement.x));
      const y = Math.max(0, Math.min(600, keyboardCursorPosition.y + movement.y));
      updateCursor(x, y);
      if (keyboardDrawing) sample(x, y, performance.now(), "keyboard", true);
      renderCapture();
    } else if (event.key === " " && !event.repeat) {
      event.preventDefault();
      if (!keyboardDrawing) {
        keyboardDrawing = true;
        sample(keyboardCursorPosition.x, keyboardCursorPosition.y, performance.now(), "keyboard", true);
        renderCapture();
      }
    } else if (event.key === "Escape") {
      event.preventDefault();
      finishKeyboardStroke();
    }
  });

  surface.addEventListener("keyup", (event) => {
    if (event.key === " " && keyboardDrawing) {
      event.preventDefault();
      finishKeyboardStroke();
    }
  });
  surface.addEventListener("blur", finishKeyboardStroke);

  const captureMetadata = () => {
    const model = selectedModel();
    return {
      schemaVersion: 1,
      datasetVersion,
      coordinateSystem: { type: "svg-viewBox", viewBox: [0, 0, 1000, 600] },
      selectedReferenceModel: model ? { id: model.id, demo: model.demo, verification: model.verification } : null,
      requestedCharacter: oneGrapheme(characterInput.value),
      reference: referenceGlyph ? {
        character: referenceGlyph.character,
        verification: referenceGlyph.verification,
        sources: referenceGlyph.sources,
        license: referenceGlyph.license,
        model: referenceGlyph.model,
      } : null,
      movementReference: referenceStrokeRecord ? {
        character: referenceStrokeRecord.character,
        model: referenceStrokeRecord.model,
        verification: referenceStrokeRecord.verification,
        sources: referenceStrokeRecord.sources,
        license: referenceStrokeRecord.license,
      } : null,
      movementComparison,
      samples,
      metrics: measureCapture(samples),
    };
  };

  const download = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  clearButton.addEventListener("click", () => {
    samples.splice(0);
    captureStartedAt = null;
    keyboardDrawing = false;
    activePointerId = null;
    updateCursor(500, 300);
    renderCapture();
    status.textContent = copy.statusReady;
  });

  form.addEventListener("reset", () => {
    samples.splice(0);
    captureStartedAt = null;
    keyboardDrawing = false;
    activePointerId = null;
    updateCursor(500, 300);
    renderCapture();
    window.setTimeout(() => {
      void updateReference();
      void updateMovementReference();
    }, 0);
  });

  exportJsonButton.addEventListener("click", () => {
    const data = JSON.stringify(captureMetadata(), null, 2);
    download(new Blob([data], { type: "application/json" }), "schreibatlas-capture.json");
  });

  exportSvgButton.addEventListener("click", () => {
    const clone = surface.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("xmlns", svgNamespace);
    clone.setAttribute("width", "1000");
    clone.setAttribute("height", "600");
    clone.querySelector("[data-writing-cursor]")?.remove();
    const metadata = svgElement("metadata");
    metadata.textContent = JSON.stringify(captureMetadata());
    clone.insertBefore(metadata, clone.firstChild);
    const svg = new XMLSerializer().serializeToString(clone);
    download(new Blob([svg], { type: "image/svg+xml" }), "schreibatlas-capture.svg");
  });

  characterInput.addEventListener("input", () => {
    void updateReference();
    void updateMovementReference();
  });
  modelSelect.addEventListener("change", () => {
    void updateReference();
    void updateMovementReference();
  });
  referenceCheckbox.addEventListener("change", () => void updateReference());
  opacityInput.addEventListener("input", () => {
    referenceLayer.querySelector<SVGPathElement>("path")?.setAttribute("fill-opacity", opacityInput.value);
  });

  try {
    const indexUrl = container.dataset.indexUrl;
    if (!indexUrl) throw new Error("Missing local writing data index.");
    const index = await localJson<ApiIndex>(indexUrl);
    datasetVersion = index.datasetVersion;
    const [entries, sources, strokes] = await Promise.all([
      localJson<GlyphIndexEntry[]>(index.glyphs),
      localJson<SourceRecord[]>(index.sources),
      localJson<StrokeIndexEntry[]>(index.strokes),
    ]);
    glyphIndex = entries;
    strokeIndex = strokes;
    localDataAvailable = true;
    for (const source of sources) sourceById.set(source.id, source);
    status.textContent = copy.statusReady;
    await updateReference();
    await updateMovementReference();
  } catch {
    status.textContent = copy.statusError;
  }
}


async function sampleStrokeAsset(fileUrl: string): Promise<{ x: number; y: number }[]> {
  const url = new URL(fileUrl, location.href);
  if (url.origin !== location.origin) throw new Error("Stroke geometry must stay same-origin.");
  const response = await fetch(url, { credentials: "same-origin" });
  if (!response.ok) throw new Error(`Local stroke geometry request failed: ${response.status}`);
  const parsed = new DOMParser().parseFromString(await response.text(), "image/svg+xml");
  const root = parsed.documentElement;
  const viewBox = root.getAttribute("viewBox")?.trim().split(/[\s,]+/).map(Number) ?? [];
  if (parsed.querySelector("parsererror") || root.localName !== "svg" || viewBox.length !== 4 || viewBox.some((value, index) => value !== [0, 0, 1, 1][index])) {
    throw new Error("Stroke geometry does not use the normalized SVG coordinate system.");
  }
  const sourcePaths = root.querySelectorAll("path[d]");
  if (sourcePaths.length !== 1) throw new Error("Each recorded stroke must have one path for movement comparison.");
  const pathData = sourcePaths[0].getAttribute("d");
  if (!pathData) throw new Error("Recorded stroke path data is empty.");

  const measuringSvg = document.createElementNS(svgNamespace, "svg");
  measuringSvg.setAttribute("viewBox", "0 0 1 1");
  measuringSvg.style.cssText = "position:fixed;left:-10000px;top:-10000px;width:1px;height:1px;visibility:hidden";
  const path = document.createElementNS(svgNamespace, "path");
  path.setAttribute("d", pathData);
  measuringSvg.append(path);
  document.body.append(measuringSvg);
  try {
    const length = path.getTotalLength();
    if (!Number.isFinite(length) || length <= 0) throw new Error("Recorded stroke path has no measurable length.");
    return Array.from({ length: 33 }, (_value, index) => {
      const point = path.getPointAtLength((length * index) / 32);
      return { x: point.x, y: point.y };
    });
  } finally {
    measuringSvg.remove();
  }
}

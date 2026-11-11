// SPDX-License-Identifier: Apache-2.0
import { isValidQuadrilateral, type ImagePoint, type PhotoAnalysisResult } from "../../tools/photo-analysis.mjs";
import type { WorksheetMarkerResult, WorksheetWritingResult } from "../../tools/worksheet-analysis.mjs";
import { BrowserTextShaper, type TextDirection } from "../lib/text-shaper";
import { fitReferenceText, measureReferenceWordSpacing, type PhotoReferenceFit, type PhotoReferenceLine } from "../../tools/photo-reference.mjs";
import type { FontExport, SourceRecord } from "../../tools/content.mjs";
import { appendFontProvenance, fontSupportsText, supportsRequiredFontFeatures } from "../lib/font-capabilities";

interface AnalysisMessages {
  statusIdle: string;
  offlineStatusReady: string;
  offlineStatusIncomplete: string;
  offlineStatusUnavailable: string;
  statusNoFile: string;
  statusProcessing: string;
  statusComplete: string;
  statusExported: string;
  statusExportError: string;
  statusFileType: string;
  statusFileSize: string;
  statusDimensions: string;
  statusDecodeError: string;
  statusExpected: string;
  statusCorners: string;
  rectifiedPreview: string;
  maskPreview: string;
  detectedLineCount: string;
  deskew: string;
  deskewConfidenceLow: string;
  deskewConfidenceMedium: string;
  threshold: string;
  thresholdUnavailable: string;
  foregroundPixels: string;
  line: string;
  lineHeight: string;
  slope: string;
  writingWidth: string;
  baselineCandidate: string;
  baselineVariation: string;
  baselineConfidenceLow: string;
  baselineNote: string;
  lineSpacing: string;
  lineSpacingUnavailable: string;
  noLines: string;
  expectedText: string;
  selectedModel: string;
  worksheetReferenceReady: string;
  worksheetNoReference: string;
  worksheetBlankRow: string;
  worksheetNoInk: string;
  worksheetReferenceInvalid: string;
  worksheetRecognized: string;
  worksheetUnavailable: string;
  worksheetLowConfidence: string;
  worksheetWritingAvailable: string;
  worksheetWritingUnavailable: string;
  worksheetRepeatedAvailable: string;
  referenceSection: string;
  referenceUnavailable: string;
  referenceFontUnavailable: string;
  referenceUnsupported: string;
  referenceFitUnavailable: string;
  referenceFitLow: string;
  referenceFitMedium: string;
  referenceComparisonNote: string;
  referenceSources: string;
  referenceView: string;
  referenceViewReference: string;
  referenceViewOverlay: string;
  referenceViewDifference: string;
  referenceScaleX: string;
  referenceScaleY: string;
  referenceResidual: string;
  referenceWordSpacing: string;
  referenceWordSpacingUnavailable: string;
}


interface DataIndex {
  fonts: string;
  sources: string;
}

interface ReferenceLayout {
  font: FontExport;
  fontFamily: string;
  fontSize: number;
  direction: TextDirection;
  lines: PhotoReferenceLine[];
}

interface ReferenceComparisonData {
  font: {
    id: string;
    name: string;
    license: string;
    licenseFileUrl: string | null;
    fileUrls: string[];
    correspondence: FontExport["correspondence"];
    sources: SourceRecord[];
    shaping: FontExport["shaping"];
    upstream: FontExport["upstream"];
    derivation: FontExport["derivation"];
    integrity: FontExport["integrity"];
    supportedCharacters: string[];
  };
  fit: PhotoReferenceFit;
  wordSpacing: ReturnType<typeof measureReferenceWordSpacing>;
}

type WorksheetReferenceMetadata = {
  worksheetId: string;
  worksheetMarker: {
    format: "schreibatlas-fiducial";
    version: 1;
    sizeMm: number;
    insetMm: number;
    moduleCount: 2;
    pageWidthMm: number;
    pageHeightMm: number;
    positionsMm: { code: number; corner: string; x: number; y: number }[];
  };
  writingRegionMm: {
    left: number;
    right: number;
    blankRows: { id: string; top: number; baseline: number; xHeight: number; height: number }[];
  };
  settings: { text: string; guides: string };
};

type WorksheetAnalysisDetails = {
  worksheetGeometry: WorksheetMarkerResult | null;
  worksheetWriting: WorksheetWritingResult | null;
};

type ResultMessage = Omit<PhotoAnalysisResult, "preview" | "mask"> & WorksheetAnalysisDetails & {
  type: "result";
  requestId: number;
  preview: ArrayBuffer;
  mask: ArrayBuffer;
};

type StoredAnalysis = PhotoAnalysisResult & WorksheetAnalysisDetails & { referenceComparison: ReferenceComparisonData | null };
type WorkerMessage =
  | { type: "progress"; requestId: number; stage: string }
  | { type: "error"; requestId: number; message: string }
  | ResultMessage;

const page = document.querySelector<HTMLElement>("[data-photo-analysis]");
if (page) initializePhotoAnalysis(page);

function parseWorksheetReference(svgText: string): WorksheetReferenceMetadata | null {
  try {
    const parsed = new DOMParser().parseFromString(svgText, "image/svg+xml");
    if (parsed.querySelector("parsererror") || parsed.documentElement.localName !== "svg") return null;
    const metadataNode = [...parsed.documentElement.children].find((element) => element.localName === "metadata");
    const source = JSON.parse(metadataNode?.textContent ?? "") as Record<string, unknown>;
    const marker = source.worksheetMarker as WorksheetReferenceMetadata["worksheetMarker"] | undefined;
    const region = source.writingRegionMm as WorksheetReferenceMetadata["writingRegionMm"] | undefined;
    const settings = source.settings as WorksheetReferenceMetadata["settings"] | undefined;
    if (source.kind !== "schreibatlas-worksheet" || source.schemaVersion !== 1 || !/^SAW1-[A-F0-9]{8}$/.test(String(source.worksheetId))) return null;
    if (!marker || marker.format !== "schreibatlas-fiducial" || marker.version !== 1 || marker.moduleCount !== 2) return null;
    if (!Number.isFinite(marker.pageWidthMm) || !Number.isFinite(marker.pageHeightMm) || marker.pageWidthMm < 100 || marker.pageWidthMm > 300 || marker.pageHeightMm < 100 || marker.pageHeightMm > 350) return null;
    if (!Array.isArray(marker.positionsMm) || marker.positionsMm.length !== 4 || new Set(marker.positionsMm.map(({ code }) => code)).size !== 4) return null;
    if (marker.positionsMm.some(({ code, x, y }) => ![1, 2, 3, 4].includes(code) || !Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x > marker.pageWidthMm || y > marker.pageHeightMm)) return null;
    if (!region || !Number.isFinite(region.left) || !Number.isFinite(region.right) || region.left < 0 || region.right <= region.left || region.right > marker.pageWidthMm) return null;
    if (!Array.isArray(region.blankRows) || region.blankRows.length > 12 || region.blankRows.some((row) => ![row.top, row.baseline, row.xHeight, row.height].every(Number.isFinite))) return null;
    if (!settings || typeof settings.text !== "string" || settings.text.length > 100 || !["none", "baseline", "baseline-xheight"].includes(settings.guides)) return null;
    return {
      worksheetId: String(source.worksheetId),
      worksheetMarker: marker,
      writingRegionMm: region,
      settings: { text: settings.text, guides: settings.guides },
    };
  } catch {
    return null;
  }
}

function initializePhotoAnalysis(container: HTMLElement): void {
  const form = container.querySelector<HTMLFormElement>("[data-analysis-controls]");
  const imageInput = container.querySelector<HTMLInputElement>("[data-analysis-image]");
  const worksheetInput = container.querySelector<HTMLInputElement>("[data-analysis-worksheet]");
  const worksheetReferenceStatus = container.querySelector<HTMLElement>("[data-analysis-worksheet-reference-status]");
  const expectedTextInput = container.querySelector<HTMLTextAreaElement>("[data-analysis-expected-text]");
  const modelSelect = container.querySelector<HTMLSelectElement>("[data-analysis-model]");
  const imageFrame = container.querySelector<HTMLElement>("[data-analysis-image-frame]");
  const preview = container.querySelector<HTMLImageElement>("[data-analysis-preview]");
  const cropOverlay = container.querySelector<SVGSVGElement>("[data-analysis-crop-overlay]");
  const cropPolygon = container.querySelector<SVGPolygonElement>("[data-analysis-crop-polygon]");
  const cornerHandles = [...container.querySelectorAll<SVGCircleElement>("[data-analysis-corner]")];
  const status = container.querySelector<HTMLElement>("[data-analysis-status]");
  const resetCropButton = container.querySelector<HTMLButtonElement>("[data-analysis-reset-crop]");
  const runButton = container.querySelector<HTMLButtonElement>("[data-analysis-run]");
  const clearButton = container.querySelector<HTMLButtonElement>("[data-analysis-clear]");
  const exportJsonButton = container.querySelector<HTMLButtonElement>("[data-analysis-export-json]");
  const exportOverlayButton = container.querySelector<HTMLButtonElement>("[data-analysis-export-overlay]");
  const results = container.querySelector<HTMLElement>("[data-analysis-results]");
  const analysisContext = container.querySelector<HTMLElement>("[data-analysis-context]");
  const worksheetResultOutput = container.querySelector<HTMLElement>("[data-analysis-worksheet-result]");
  const lineCount = container.querySelector<HTMLElement>("[data-analysis-line-count]");
  const deskewOutput = container.querySelector<HTMLElement>("[data-analysis-deskew]");
  const thresholdOutput = container.querySelector<HTMLElement>("[data-analysis-threshold]");
  const foregroundOutput = container.querySelector<HTMLElement>("[data-analysis-foreground]");
  const lineSpacingOutput = container.querySelector<HTMLElement>("[data-analysis-line-spacing]");
  const lineList = container.querySelector<HTMLUListElement>("[data-analysis-lines]");
  const rectifiedCanvas = container.querySelector<HTMLCanvasElement>("[data-analysis-rectified]");
  const maskCanvas = container.querySelector<HTMLCanvasElement>("[data-analysis-mask]");
  const offlineStatus = container.querySelector<HTMLElement>("[data-offline-status]");
  const overlayCanvas = container.querySelector<HTMLCanvasElement>("[data-analysis-overlay]");
  const wordGapsOutput = container.querySelector<HTMLElement>("[data-analysis-word-gaps]");
  const referenceStatus = container.querySelector<HTMLElement>("[data-analysis-reference-status]");
  const referenceFontOutput = container.querySelector<HTMLElement>("[data-analysis-reference-font]");
  const referenceSourcesTitle = container.querySelector<HTMLElement>("[data-analysis-reference-sources-title]");
  const referenceSources = container.querySelector<HTMLUListElement>("[data-analysis-reference-sources]");
  const referenceViewSelect = container.querySelector<HTMLSelectElement>("[data-analysis-reference-view]");
  const referenceFigure = container.querySelector<HTMLElement>("[data-analysis-reference-figure]");
  const referenceCanvas = container.querySelector<HTMLCanvasElement>("[data-analysis-reference-canvas]");
  const referenceCaption = container.querySelector<HTMLElement>("[data-analysis-reference-caption]");
  const referenceMetrics = container.querySelector<HTMLElement>("[data-analysis-reference-metrics]");
  const referenceScaleX = container.querySelector<HTMLElement>("[data-analysis-reference-scale-x]");
  const referenceScaleY = container.querySelector<HTMLElement>("[data-analysis-reference-scale-y]");
  const referenceResidual = container.querySelector<HTMLElement>("[data-analysis-reference-residual]");
  const referenceWordSpacing = container.querySelector<HTMLElement>("[data-analysis-reference-word-spacing]");
  if (
    !form || !imageInput || !worksheetInput || !worksheetReferenceStatus || !worksheetResultOutput || !expectedTextInput || !modelSelect
    || !imageFrame || !preview || !cropOverlay || !cropPolygon || !status || !resetCropButton || !runButton || !clearButton
    || !exportJsonButton || !exportOverlayButton || !results || !analysisContext || !lineCount || !deskewOutput || !thresholdOutput
    || !foregroundOutput || !lineSpacingOutput || !lineList || !rectifiedCanvas || !maskCanvas || !overlayCanvas || !wordGapsOutput
    || !referenceStatus || !referenceFontOutput || !referenceSourcesTitle || !referenceSources || !referenceViewSelect
    || !referenceFigure || !referenceCanvas || !referenceCaption || !referenceMetrics || !referenceScaleX || !referenceScaleY
    || !referenceResidual || !referenceWordSpacing || cornerHandles.length !== 4
  ) return;

  const copy = JSON.parse(container.dataset.messages ?? "{}") as AnalysisMessages;
  const maxFileBytes = 20 * 1024 * 1024;
  const maxImagePixels = 18_000_000;
  const maxWorksheetBytes = 1_000_000;
  let selectedFile: File | null = null;
  let worksheetMetadata: WorksheetReferenceMetadata | null = null;
  let previewUrl: string | null = null;
  let imageWidth = 0;
  let imageHeight = 0;
  let corners: ImagePoint[] = [];
  let dragIndex: number | null = null;
  let worker: Worker | null = null;
  let requestId = 0;
  let offlineWorker: Worker | null = null;
  const downloadUrls = new Set<string>();
  let latestAnalysis: StoredAnalysis | null = null;
  const fontById = new Map<string, FontExport>();
  const sourceById = new Map<string, SourceRecord>();
  const familyByFontId = new Map<string, string>();
  const loadedFontPromises = new Map<string, Promise<string>>();
  const shaper = new BrowserTextShaper(familyByFontId);
  let referenceLayout: ReferenceLayout | null = null;
  let referenceFit: PhotoReferenceFit | null = null;
  let referenceDataFailed = false;

  const format = new Intl.NumberFormat(document.documentElement.lang, { maximumFractionDigits: 1 });
  const localUrl = (value: string) => {
    const url = new URL(value, location.href);
    if (url.origin !== location.origin) throw new Error("Photo reference data must stay same-origin.");
    return url.href;
  };

  const referenceDataPromise = (async () => {
    try {
      if (!container.dataset.indexUrl) throw new Error("Missing local data index.");
      const indexResponse = await fetch(localUrl(container.dataset.indexUrl), { credentials: "same-origin" });
      if (!indexResponse.ok) throw new Error("Local data index request failed.");
      const index = await indexResponse.json() as DataIndex;
      const [fontResponse, sourceResponse] = await Promise.all([
        fetch(localUrl(index.fonts), { credentials: "same-origin" }),
        fetch(localUrl(index.sources), { credentials: "same-origin" }),
      ]);
      if (!fontResponse.ok || !sourceResponse.ok) throw new Error("Local font or source request failed.");
      const [fonts, sources] = await Promise.all([fontResponse.json(), sourceResponse.json()]) as [FontExport[], SourceRecord[]];
      for (const font of fonts) fontById.set(font.id, font);
      for (const source of sources) sourceById.set(source.id, source);
    } catch {
      referenceDataFailed = true;
    }
  })();

  const loadReferenceFont = async (font: FontExport) => {
    if (!font.file_urls?.length) throw new Error("The reference font has no local asset.");
    let pending = loadedFontPromises.get(font.id);
    if (!pending) {
      const family = `schreibatlas-photo-${font.id}`;
      const sources = font.file_urls.map((url) => `url(\"${localUrl(url)}\")`).join(", ");
      pending = new FontFace(family, sources).load().then((face) => {
        document.fonts.add(face);
        familyByFontId.set(font.id, family);
        return family;
      });
      loadedFontPromises.set(font.id, pending);
    }
    return pending;
  };

  const selectedReferenceFont = () => {
    const option = modelSelect.selectedOptions[0];
    let fontIds: string[];
    try {
      fontIds = JSON.parse(option?.dataset.referenceFonts ?? "[]") as string[];
    } catch {
      return null;
    }
    return fontIds.map((id) => fontById.get(id)).find((font) => Boolean(font
      && font.correspondence.model === modelSelect.value
      && font.file_urls?.length
      && font.calibration
      && Number.isFinite(font.calibration.x_height_em)
      && font.calibration.x_height_em > 0)) ?? null;
  };

  const shapeReferenceText = async (font: FontExport, text: string): Promise<ReferenceLayout> => {
    const option = modelSelect.selectedOptions[0];
    const direction: TextDirection = option?.dataset.direction === "rtl" ? "rtl" : "ltr";
    if (direction === "rtl") throw new Error("RTL reference fitting is not implemented.");
    const language = option?.dataset.language ?? undefined;
    await loadReferenceFont(font);
    const run = await shaper.shape({ text, fontId: font.id, features: font.shaping?.required_features, language, direction });
    const fontSize = 40 / font.calibration!.x_height_em;
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Reference text metrics are unavailable.");
    context.font = `${fontSize}px \"${run.fontFamily}\"`;
    context.fontKerning = font.shaping?.required_features.includes("kern") ? "normal" : "auto";
    context.direction = direction;
    const lineTexts = text.trim().split(/\r\n?|\n/);
    if (lineTexts.some((line) => !line.trim())) throw new Error("Blank reference text lines are not aligned.");
    const lineSpacing = fontSize * 1.5;
    const lines = lineTexts.map((lineText, lineIndex) => {
      const metrics = context.measureText(lineText);
      const left = Number.isFinite(metrics.actualBoundingBoxLeft) ? metrics.actualBoundingBoxLeft : 0;
      const right = Number.isFinite(metrics.actualBoundingBoxRight) ? metrics.actualBoundingBoxRight : metrics.width;
      const ascent = Number.isFinite(metrics.actualBoundingBoxAscent) ? metrics.actualBoundingBoxAscent : 0;
      const descent = Number.isFinite(metrics.actualBoundingBoxDescent) ? metrics.actualBoundingBoxDescent : 0;
      const words = [...new Intl.Segmenter(language, { granularity: "word" }).segment(lineText)].filter((part) => part.isWordLike);
      const wordBoundaries = words.slice(0, -1).flatMap((word, index) => {
        const next = words[index + 1];
        const leftEdge = context.measureText(lineText.slice(0, word.index + word.segment.length)).width;
        const rightEdge = context.measureText(lineText.slice(0, next.index)).width;
        return rightEdge > leftEdge ? [{ center: (leftEdge + rightEdge) / 2, width: rightEdge - leftEdge }] : [];
      });
      return {
        text: lineText,
        inkLeft: -left,
        inkRight: right,
        ascent,
        descent,
        baseline: ascent + lineIndex * lineSpacing,
        wordBoundaries,
      };
    });
    return { font, fontFamily: run.fontFamily, fontSize, direction, lines };
  };

  const prepareOfflineWorker = () => {
    if (!offlineStatus || !navigator.serviceWorker?.controller || offlineWorker) return;
    try {
      const currentWorker = new Worker(new URL("../workers/photo-analysis.worker.ts", import.meta.url), { type: "module" });
      offlineWorker = currentWorker;
      currentWorker.onmessage = ({ data }: MessageEvent<{ type: string }>) => {
        if (data.type !== "prepared") return;
        currentWorker.terminate();
        if (offlineWorker === currentWorker) offlineWorker = null;
        offlineStatus.textContent = copy.offlineStatusReady;
      };
      currentWorker.onerror = () => {
        currentWorker.terminate();
        if (offlineWorker === currentWorker) offlineWorker = null;
        offlineStatus.textContent = copy.offlineStatusIncomplete;
      };
      currentWorker.postMessage({ type: "prepare" });
    } catch {
      offlineStatus.textContent = copy.offlineStatusUnavailable;
    }
  };

  if (offlineStatus) {
    navigator.serviceWorker?.addEventListener("controllerchange", prepareOfflineWorker);
    window.addEventListener("schreibatlas-offline-assets-cached", prepareOfflineWorker, { once: true });
    if (document.documentElement.dataset.offlineAssetsCached === "true") prepareOfflineWorker();
  }

  const clearResults = () => {
    results.hidden = true;
    latestAnalysis = null;
    referenceLayout = null;
    referenceFit = null;
    referenceStatus.textContent = copy.referenceUnavailable;
    referenceFontOutput.textContent = "";
    referenceSources.replaceChildren();
    referenceSources.hidden = true;
    referenceSourcesTitle.hidden = true;
    referenceViewSelect.disabled = true;
    referenceFigure.hidden = true;
    referenceMetrics.hidden = true;
    referenceCanvas.width = 0;
    referenceCanvas.height = 0;
    wordGapsOutput.textContent = copy.referenceWordSpacingUnavailable;
    exportJsonButton.disabled = true;
    exportOverlayButton.disabled = true;
    analysisContext.textContent = "";
    worksheetResultOutput.textContent = "";
    lineCount.textContent = "0";
    deskewOutput.textContent = "0";
    thresholdOutput.textContent = "0";
    foregroundOutput.textContent = "0";
    lineSpacingOutput.textContent = "";
    lineList.replaceChildren();
    rectifiedCanvas.width = 0;
    rectifiedCanvas.height = 0;
    maskCanvas.width = 0;
    maskCanvas.height = 0;
    overlayCanvas.width = 0;
    overlayCanvas.height = 0;
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    downloadUrls.add(url);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.hidden = true;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => {
      if (downloadUrls.delete(url)) URL.revokeObjectURL(url);
    }, 1000);
  };


  const renderReferenceSources = (font: FontExport) => {
    referenceSources.replaceChildren();
    for (const sourceId of font.sources) {
      const source = sourceById.get(sourceId);
      if (!source) continue;
      const item = document.createElement("li");
      const details = [source.title, ...source.author];
      if (source.year !== null) details.push(String(source.year));
      if (source.rights.license) details.push(source.rights.license);
      item.textContent = details.join(" · ");
      if (source.url && /^https?:\/\//.test(source.url)) {
        const link = document.createElement("a");
        link.href = source.url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = source.url;
        item.append(" ", link);
      }
      referenceSources.append(item);
    }
    referenceSources.hidden = referenceSources.childElementCount === 0;
    referenceSourcesTitle.hidden = referenceSources.hidden;
  };

  const drawReferenceText = (context: CanvasRenderingContext2D, layout: ReferenceLayout, fit: PhotoReferenceFit, color: string, opacity: number) => {
    if (!fit.transform) return;
    context.save();
    context.setTransform(fit.transform.scaleX, 0, 0, fit.transform.scaleY, fit.transform.translateX, fit.transform.translateY);
    context.font = `${layout.fontSize}px \"${layout.fontFamily}\"`;
    context.fontKerning = layout.font.shaping?.required_features.includes("kern") ? "normal" : "auto";
    context.direction = layout.direction;
    context.textAlign = "left";
    context.textBaseline = "alphabetic";
    context.fillStyle = color;
    context.globalAlpha = opacity;
    for (const line of layout.lines) context.fillText(line.text, 0, line.baseline);
    context.restore();
  };

  const renderReferenceView = () => {
    if (!latestAnalysis || !referenceLayout || !referenceFit?.available || !referenceFit.transform) return;
    const width = latestAnalysis.width;
    const height = latestAnalysis.height;
    referenceCanvas.width = width;
    referenceCanvas.height = height;
    const context = referenceCanvas.getContext("2d");
    if (!context) return;
    const mode = referenceViewSelect.value;
    const captions: Record<string, string> = {
      reference: copy.referenceViewReference,
      overlay: copy.referenceViewOverlay,
      difference: copy.referenceViewDifference,
    };
    referenceCaption.textContent = captions[mode] ?? copy.referenceViewReference;
    referenceCanvas.setAttribute("aria-label", referenceCaption.textContent);

    if (mode === "reference") {
      context.fillStyle = "white";
      context.fillRect(0, 0, width, height);
      drawReferenceText(context, referenceLayout, referenceFit, "#075b91", 1);
      return;
    }
    if (mode === "overlay") {
      const previewImage = context.createImageData(width, height);
      previewImage.data.set(latestAnalysis.preview);
      context.putImageData(previewImage, 0, 0);
      drawReferenceText(context, referenceLayout, referenceFit, "#075b91", 0.55);
      return;
    }

    const referenceMask = document.createElement("canvas");
    referenceMask.width = width;
    referenceMask.height = height;
    const referenceContext = referenceMask.getContext("2d");
    if (!referenceContext) return;
    drawReferenceText(referenceContext, referenceLayout, referenceFit, "black", 1);
    const referencePixels = referenceContext.getImageData(0, 0, width, height).data;
    const difference = context.createImageData(width, height);
    for (let pixel = 0; pixel < latestAnalysis.mask.length; pixel += 1) {
      const offset = pixel * 4;
      const observed = latestAnalysis.mask[pixel] === 1;
      const expected = referencePixels[offset + 3] > 32;
      const color = observed && expected ? [24, 128, 80] : observed ? [194, 45, 47] : expected ? [25, 96, 166] : [255, 255, 255];
      difference.data[offset] = color[0];
      difference.data[offset + 1] = color[1];
      difference.data[offset + 2] = color[2];
      difference.data[offset + 3] = 255;
    }
    context.putImageData(difference, 0, 0);
  };

  const renderReferenceComparison = async (analysis: StoredAnalysis) => {
    await referenceDataPromise;
    if (latestAnalysis !== analysis) return null;
    referenceLayout = null;
    referenceFit = null;
    referenceFigure.hidden = true;
    referenceMetrics.hidden = true;
    referenceViewSelect.disabled = true;
    if (referenceDataFailed) {
      referenceStatus.textContent = copy.referenceFontUnavailable;
      wordGapsOutput.textContent = copy.referenceWordSpacingUnavailable;
      return null;
    }
    const font = selectedReferenceFont();
    if (!font) {
      referenceStatus.textContent = copy.referenceUnavailable;
      wordGapsOutput.textContent = copy.referenceWordSpacingUnavailable;
      return null;
    }

    renderReferenceSources(font);
    const correspondence = `${font.correspondence.degree}${font.correspondence.notes ? ` · ${font.correspondence.notes}` : ""}`;
    referenceFontOutput.replaceChildren(document.createTextNode(`${font.name} · ${correspondence} · OpenType: ${font.shaping?.required_features.join(", ") ?? "not documented"} · `));
    if (font.license_file_url) {
      const licenseLink = document.createElement("a");
      licenseLink.href = localUrl(font.license_file_url);
      licenseLink.textContent = font.license;
      referenceFontOutput.append(licenseLink);
    } else referenceFontOutput.append(document.createTextNode(font.license));
    appendFontProvenance(referenceFontOutput, font, document.documentElement.lang === "de" ? "de" : "en");
    const text = expectedTextInput.value.trim();
    if (!fontSupportsText(font, text) || !supportsRequiredFontFeatures(font)) {
      referenceStatus.textContent = copy.referenceUnsupported;
      wordGapsOutput.textContent = copy.referenceWordSpacingUnavailable;
      return null;
    }
    try {

      const layout = await shapeReferenceText(font, text);
      if (latestAnalysis !== analysis) return null;
      const fit = fitReferenceText(layout.lines, analysis.lines);
      const wordSpacing = measureReferenceWordSpacing(layout.lines, analysis.lines, analysis.mask, analysis.width, analysis.height, fit);
      referenceLayout = layout;
      referenceFit = fit;
      analysis.referenceComparison = {
        font: {
          id: font.id,
          name: font.name,
          license: font.license,
          licenseFileUrl: font.license_file_url ?? null,
          fileUrls: font.file_urls ?? [],
          correspondence: font.correspondence,
          sources: font.sources.map((id) => sourceById.get(id)).filter((source): source is SourceRecord => source !== undefined),
          shaping: font.shaping,
          upstream: font.upstream,
          derivation: font.derivation,
          integrity: font.integrity,
          supportedCharacters: font.supported_characters,
        },
        fit,
        wordSpacing,
      };
      if (!fit.available) {
        referenceStatus.textContent = copy.referenceFitUnavailable;
        wordGapsOutput.textContent = copy.referenceWordSpacingUnavailable;
        return analysis.referenceComparison;
      }
      referenceStatus.textContent = fit.confidence === "medium" ? copy.referenceFitMedium : copy.referenceFitLow;
      referenceViewSelect.disabled = false;
      referenceFigure.hidden = false;
      referenceMetrics.hidden = fit.confidence !== "medium";
      if (fit.confidence === "medium" && fit.transform) {
        referenceScaleX.textContent = format.format(fit.transform.scaleX);
        referenceScaleY.textContent = format.format(fit.transform.scaleY);
        referenceResidual.textContent = format.format(fit.residual ?? 0);
      }
      const spacingText = wordSpacing.available
        ? `${format.format(wordSpacing.value ?? 0)}× (${wordSpacing.confidence})`
        : copy.referenceWordSpacingUnavailable;
      referenceWordSpacing.textContent = spacingText;
      wordGapsOutput.textContent = spacingText;
      renderReferenceView();
      return analysis.referenceComparison;
    } catch {
      referenceStatus.textContent = copy.referenceFontUnavailable;
      wordGapsOutput.textContent = copy.referenceWordSpacingUnavailable;
      return null;
    }
  };

  const cancelWorker = () => {
    requestId += 1;
    worker?.terminate();
    worker = null;
  };

  const releaseImage = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = null;
    selectedFile = null;
    imageWidth = 0;
    imageHeight = 0;
    corners = [];
    preview.onload = null;
    preview.onerror = null;
    preview.removeAttribute("src");
    imageFrame.hidden = true;
    cropPolygon.setAttribute("points", "");
    cornerHandles.forEach((handle) => handle.removeAttribute("cx"));
    cornerHandles.forEach((handle) => handle.removeAttribute("cy"));
    resetCropButton.disabled = true;
  };

  const updateControls = () => {
    const ready = Boolean(selectedFile && imageWidth && imageHeight);
    resetCropButton.disabled = !ready;
    runButton.disabled = !ready || !expectedTextInput.value.trim() || !modelSelect.value || !isValidQuadrilateral(corners, imageWidth, imageHeight);
    clearButton.disabled = !Boolean(selectedFile || worksheetMetadata || worksheetInput.files?.length || expectedTextInput.value || !results.hidden);
  };

  const invalidateResults = () => {
    cancelWorker();
    clearResults();
    if (selectedFile) status.textContent = copy.statusIdle;
    updateControls();
  };

  const fullImageCorners = (): ImagePoint[] => [
    { x: 0, y: 0 },
    { x: imageWidth - 1, y: 0 },
    { x: imageWidth - 1, y: imageHeight - 1 },
    { x: 0, y: imageHeight - 1 },
  ];

  const renderCorners = () => {
    if (!imageWidth || !imageHeight || corners.length !== 4) return;
    cropOverlay.setAttribute("viewBox", `0 0 ${imageWidth} ${imageHeight}`);
    cropPolygon.setAttribute("points", corners.map(({ x, y }) => `${x},${y}`).join(" "));
    const screenScale = Math.max(Math.abs(cropOverlay.getScreenCTM()?.a ?? 1), 0.1);
    cornerHandles.forEach((handle, index) => {
      const point = corners[index];
      handle.setAttribute("cx", String(point.x));
      handle.setAttribute("cy", String(point.y));
      handle.setAttribute("aria-description", `${Math.round(point.x)}, ${Math.round(point.y)} pixels`);
      handle.setAttribute("r", String(12 / screenScale));
    });
    updateControls();
  };

  const invalidateForInputChange = () => {
    invalidateResults();
    if (selectedFile) status.textContent = copy.statusIdle;
  };

  const handleCoordinates = (event: PointerEvent) => {
    const matrix = cropOverlay.getScreenCTM();
    if (!matrix) return { x: 0, y: 0 };
    const point = cropOverlay.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const local = point.matrixTransform(matrix.inverse());
    return {
      x: Math.max(0, Math.min(imageWidth - 1, local.x)),
      y: Math.max(0, Math.min(imageHeight - 1, local.y)),
    };
  };

  const moveCorner = (index: number, point: ImagePoint) => {
    corners[index] = point;
    renderCorners();
    if (!isValidQuadrilateral(corners, imageWidth, imageHeight)) status.textContent = copy.statusCorners;
    else if (status.textContent === copy.statusCorners) status.textContent = copy.statusIdle;
  };

  cropOverlay.addEventListener("pointerdown", (event) => {
    const target = event.target instanceof SVGCircleElement ? event.target : null;
    const index = target ? Number(target.dataset.analysisCorner) : Number.NaN;
    if (!Number.isInteger(index) || index < 0 || index > 3) return;
    event.preventDefault();
    dragIndex = index;
    cropOverlay.setPointerCapture(event.pointerId);
    invalidateForInputChange();
    moveCorner(index, handleCoordinates(event));
  });

  cropOverlay.addEventListener("pointermove", (event) => {
    if (dragIndex === null) return;
    event.preventDefault();
    moveCorner(dragIndex, handleCoordinates(event));
  });

  const stopDragging = () => { dragIndex = null; };
  cropOverlay.addEventListener("pointerup", stopDragging);
  cropOverlay.addEventListener("pointercancel", stopDragging);
  cropOverlay.addEventListener("lostpointercapture", stopDragging);

  cornerHandles.forEach((handle, index) => {
    handle.addEventListener("keydown", (event) => {
      const delta = event.shiftKey ? 16 : 4;
      const offsets: Record<string, ImagePoint> = {
        ArrowLeft: { x: -delta, y: 0 },
        ArrowRight: { x: delta, y: 0 },
        ArrowUp: { x: 0, y: -delta },
        ArrowDown: { x: 0, y: delta },
      };
      const offset = offsets[event.key];
      if (!offset) return;
      event.preventDefault();
      invalidateForInputChange();
      moveCorner(index, {
        x: Math.max(0, Math.min(imageWidth - 1, corners[index].x + offset.x)),
        y: Math.max(0, Math.min(imageHeight - 1, corners[index].y + offset.y)),
      });
    });
  });

  const chooseImage = (file: File | null) => {
    cancelWorker();
    clearResults();
    releaseImage();
    if (!file) {
      status.textContent = copy.statusNoFile;
      updateControls();
      return;
    }
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      imageInput.value = "";
      status.textContent = copy.statusFileType;
      updateControls();
      return;
    }
    if (file.size > maxFileBytes) {
      imageInput.value = "";
      status.textContent = copy.statusFileSize;
      updateControls();
      return;
    }

    selectedFile = file;
    const url = URL.createObjectURL(file);
    previewUrl = url;
    preview.onload = () => {
      if (previewUrl !== url) return;
      imageWidth = preview.naturalWidth;
      imageHeight = preview.naturalHeight;
      if (imageWidth * imageHeight > maxImagePixels) {
        imageInput.value = "";
        releaseImage();
        status.textContent = copy.statusDimensions;
        updateControls();
        return;
      }
      corners = fullImageCorners();
      imageFrame.hidden = false;
      renderCorners();
      status.textContent = copy.statusIdle;
      updateControls();
    };
    preview.onerror = () => {
      if (previewUrl !== url) return;
      imageInput.value = "";
      releaseImage();
      status.textContent = copy.statusDecodeError;
      updateControls();
    };
    preview.src = url;
    updateControls();
  };

  const exportMeasurements = () => {
    if (!latestAnalysis) return;
    const { preview, mask, referenceComparison, ...metrics } = latestAnalysis;
    void preview;
    void mask;
    const model = modelSelect.selectedOptions[0];
    const report = {
      format: "schreibatlas-photo-analysis",
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      context: {
        expectedText: expectedTextInput.value.trim(),
        modelId: modelSelect.value,
        modelLabel: model?.textContent?.trim() ?? modelSelect.value,
        modelUsedForScoring: false,
        referenceFontId: latestAnalysis.referenceComparison?.font.id ?? null,
        referenceUsedForAlignment: latestAnalysis.referenceComparison?.fit.available ?? false,
      },
      imageDimensions: { inputWidth: imageWidth, inputHeight: imageHeight, rectifiedWidth: latestAnalysis.width, rectifiedHeight: latestAnalysis.height },
      metrics,
      referenceComparison,
      unavailable: { wordGaps: latestAnalysis.referenceComparison?.wordSpacing ?? { available: false, reason: "no-reference-fit", confidence: "unavailable", referenceUsed: false, observations: [] } },
      limitations: ["no_ocr", "no_model_scoring", "reference_font_is_a_digital_interpretation", "reference_fit_uses_bounded_axis_scales_and_translation_only", "line_spacing_is_a_display_convention", "baseline_is_low_confidence_lower_ink_envelope", "worksheet_measurements_require_a_matching_local_svg_and_confident_markers", ...(latestAnalysis.worksheetGeometry?.status === "recognized" ? [] : ["measurements_depend_on_manual_crop"])],
    };
    try {
      downloadBlob(new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }), "schreibatlas-photo-analysis.json");
      status.textContent = copy.statusExported;
    } catch {
      status.textContent = copy.statusExportError;
    }
  };

  const exportOverlay = () => {
    if (!latestAnalysis) return;
    try {
      overlayCanvas.toBlob((blob) => {
        if (!blob) {
          status.textContent = copy.statusExportError;
          return;
        }
        try {
          downloadBlob(blob, "schreibatlas-photo-analysis-overlay.png");
          status.textContent = copy.statusExported;
        } catch {
          status.textContent = copy.statusExportError;
        }
      }, "image/png");
    } catch {
      status.textContent = copy.statusExportError;
    }
  };

  const displayResult = async (message: ResultMessage) => {
    const previewPixels = new Uint8ClampedArray(message.preview);
    const mask = new Uint8Array(message.mask);
    latestAnalysis = {
      preview: previewPixels,
      mask,
      width: message.width,
      height: message.height,
      threshold: message.threshold,
      deskewDegrees: message.deskewDegrees,
      deskewConfidence: message.deskewConfidence,
      foregroundPixels: message.foregroundPixels,
      lines: message.lines,
      lineSpacing: message.lineSpacing,
      worksheetGeometry: message.worksheetGeometry,
      worksheetWriting: message.worksheetWriting,
      referenceComparison: null,
    };
    exportJsonButton.disabled = false;
    exportOverlayButton.disabled = false;
    rectifiedCanvas.width = message.width;
    rectifiedCanvas.height = message.height;
    const previewContext = rectifiedCanvas.getContext("2d");
    previewContext?.putImageData(new ImageData(previewPixels, message.width, message.height), 0, 0);

    const maskPixels = new Uint8ClampedArray(mask.length * 4);
    for (let index = 0; index < mask.length; index += 1) {
      const color = mask[index] ? 0 : 255;
      const offset = index * 4;
      maskPixels[offset] = color;
      maskPixels[offset + 1] = color;
      maskPixels[offset + 2] = color;
      maskPixels[offset + 3] = 255;
    }
    maskCanvas.width = message.width;
    maskCanvas.height = message.height;
    maskCanvas.getContext("2d")?.putImageData(new ImageData(maskPixels, message.width, message.height), 0, 0);

    const overlayPixels = previewPixels.slice();
    for (let index = 0; index < mask.length; index += 1) {
      if (!mask[index]) continue;
      const offset = index * 4;
      overlayPixels[offset] = 196;
      overlayPixels[offset + 1] = 48;
      overlayPixels[offset + 2] = 54;
    }
    overlayCanvas.width = message.width;
    overlayCanvas.height = message.height;
    const overlayContext = overlayCanvas.getContext("2d");
    overlayContext?.putImageData(new ImageData(overlayPixels, message.width, message.height), 0, 0);
    if (overlayContext) {
      overlayContext.save();
      overlayContext.lineWidth = Math.max(1, Math.min(message.width, message.height) / 500);
      for (const line of message.lines) {
        overlayContext.strokeStyle = "#075b91";
        overlayContext.setLineDash([]);
        overlayContext.strokeRect(line.x, line.y, line.width, line.height);
        const centerX = line.x + line.width / 2;
        const slope = Math.tan(line.baselineCandidate.slopeDegrees * Math.PI / 180);
        const leftY = line.baselineCandidate.y + slope * (line.x - centerX);
        const rightX = line.x + line.width;
        const rightY = line.baselineCandidate.y + slope * (rightX - centerX);
        overlayContext.strokeStyle = "#bd5b00";
        overlayContext.setLineDash([overlayContext.lineWidth * 4, overlayContext.lineWidth * 2]);
        overlayContext.beginPath();
        overlayContext.moveTo(line.x, leftY);
        overlayContext.lineTo(rightX, rightY);
        overlayContext.stroke();
      }
      overlayContext.restore();
    }

    lineCount.textContent = format.format(message.lines.length);
    deskewOutput.textContent = `${format.format(message.deskewDegrees)}° (${message.deskewConfidence === "medium" ? copy.deskewConfidenceMedium : copy.deskewConfidenceLow})`;
    thresholdOutput.textContent = message.threshold === null ? copy.thresholdUnavailable : format.format(message.threshold);
    foregroundOutput.textContent = format.format(message.foregroundPixels);
    const modelName = modelSelect.selectedOptions[0]?.textContent ?? modelSelect.value;
    analysisContext.textContent = `${copy.expectedText}: ${expectedTextInput.value.trim()} · ${copy.selectedModel}: ${modelName}`;
    if (!worksheetMetadata) worksheetResultOutput.textContent = copy.worksheetNoReference;
    else if (message.worksheetGeometry?.status === "low-confidence") worksheetResultOutput.textContent = copy.worksheetLowConfidence;
    else if (message.worksheetGeometry?.status !== "recognized") worksheetResultOutput.textContent = copy.worksheetUnavailable;
    else {
      const writing = message.worksheetWriting;
      worksheetResultOutput.textContent = `${copy.worksheetRecognized} ${writing?.status === "measured" ? copy.worksheetWritingAvailable : copy.worksheetWritingUnavailable}`;
      if (writing?.status === "measured") {
        const measurements = writing.rows.filter((row) => row.status === "measured").map((row) => {
          const id = typeof row.id === "string" ? row.id : "?";
          const bounds = row.inkBoundsMm as { left: number; right: number; top: number; bottom: number } | null;
          if (!bounds) return `${copy.worksheetBlankRow} ${id}: ${copy.worksheetNoInk}`;
          return `${copy.worksheetBlankRow} ${id}: ${format.format(bounds.right - bounds.left)} × ${format.format(bounds.bottom - bounds.top)} mm`;
        });
        if (measurements.length) worksheetResultOutput.textContent += ` ${measurements.join("; ")}.`;
      }
      const repeated = writing?.repeatedLetterAnalysis;
      if (repeated?.status === "available" && typeof repeated.character === "string") {
        worksheetResultOutput.textContent += ` ${copy.worksheetRepeatedAvailable}: ${repeated.character}`;
      } else if (writing?.status === "measured") worksheetResultOutput.textContent += ` ${copy.worksheetWritingUnavailable}`;
    }
    lineSpacingOutput.textContent = message.lineSpacing.length
      ? `${copy.lineSpacing}: ${message.lineSpacing.map((value) => format.format(value)).join(", ")}`
      : copy.lineSpacingUnavailable;

    lineList.replaceChildren();
    if (!message.lines.length) {
      const item = document.createElement("li");
      item.textContent = copy.noLines;
      lineList.append(item);
    }
    for (const line of message.lines) {
      const item = document.createElement("li");
      const baseline = line.baselineCandidate;
      item.textContent = `${copy.line} ${line.index + 1}: ${copy.writingWidth} ${format.format(line.width)} px; ${copy.lineHeight} ${format.format(line.height)} px; ${copy.baselineCandidate} y=${format.format(baseline.y)} px, ${copy.slope} ${format.format(baseline.slopeDegrees)}° (${copy.baselineConfidenceLow}); ${copy.baselineVariation} ${format.format(baseline.residualStdDev)} px.`;
      lineList.append(item);
    }
    const analysis = latestAnalysis;
    if (!analysis) return;
    await renderReferenceComparison(analysis);
    if (latestAnalysis !== analysis) return;
    results.hidden = false;
  };

  const runAnalysis = () => {
    if (!selectedFile) {
      status.textContent = copy.statusNoFile;
      return;
    }
    if (!expectedTextInput.value.trim() || !modelSelect.value) {
      status.textContent = copy.statusExpected;
      return;
    }
    if (!isValidQuadrilateral(corners, imageWidth, imageHeight)) {
      status.textContent = copy.statusCorners;
      return;
    }

    cancelWorker();
    clearResults();
    status.textContent = copy.statusProcessing;
    const currentRequest = ++requestId;
    try {
      const currentWorker = new Worker(new URL("../workers/photo-analysis.worker.ts", import.meta.url), { type: "module" });
      worker = currentWorker;
      currentWorker.onmessage = ({ data }: MessageEvent<WorkerMessage>) => {
        if (data.requestId !== currentRequest || worker !== currentWorker) return;
        if (data.type === "progress") {
          status.textContent = copy.statusProcessing;
          return;
        }
        currentWorker.terminate();
        worker = null;
        if (data.type === "error") {
          status.textContent = copy.statusDecodeError;
          return;
        }
        void displayResult(data).then(() => {
          if (requestId === currentRequest) status.textContent = copy.statusComplete;
        }).catch(() => {
          if (requestId === currentRequest) status.textContent = copy.statusDecodeError;
        });
      };
      currentWorker.onerror = () => {
        currentWorker.terminate();
        if (worker === currentWorker) worker = null;
        status.textContent = copy.statusDecodeError;
      };
      currentWorker.postMessage({ type: "analyze", requestId: currentRequest, file: selectedFile, corners, worksheetMetadata });
    } catch {
      worker?.terminate();
      worker = null;
      status.textContent = copy.statusDecodeError;
    }
  };

  const chooseWorksheetReference = async (file: File | null) => {
    worksheetMetadata = null;
    worksheetReferenceStatus.textContent = "";
    invalidateResults();
    if (!file) {
      updateControls();
      return;
    }
    if (file.size > maxWorksheetBytes) {
      worksheetReferenceStatus.textContent = copy.worksheetReferenceInvalid;
      updateControls();
      return;
    }
    try {
      const parsed = parseWorksheetReference(await file.text());
      if (!parsed) worksheetReferenceStatus.textContent = copy.worksheetReferenceInvalid;
      else {
        worksheetMetadata = parsed;
        worksheetReferenceStatus.textContent = `${copy.worksheetReferenceReady}${parsed.worksheetId}`;
      }
    } catch {
      worksheetReferenceStatus.textContent = copy.worksheetReferenceInvalid;
    }
    updateControls();
  };

  const clearImageAndResults = () => {
    cancelWorker();
    releaseImage();
    imageInput.value = "";
    worksheetInput.value = "";
    worksheetMetadata = null;
    worksheetReferenceStatus.textContent = "";
    expectedTextInput.value = "";
    clearResults();
    status.textContent = copy.statusIdle;
    updateControls();
  };

  imageInput.addEventListener("change", () => chooseImage(imageInput.files?.[0] ?? null));
  worksheetInput.addEventListener("change", () => { void chooseWorksheetReference(worksheetInput.files?.[0] ?? null); });
  expectedTextInput.addEventListener("input", invalidateForInputChange);
  modelSelect.addEventListener("change", invalidateForInputChange);
  referenceViewSelect.addEventListener("change", renderReferenceView);
  resetCropButton.addEventListener("click", () => {
    if (!selectedFile) return;
    invalidateForInputChange();
    corners = fullImageCorners();
    renderCorners();
    status.textContent = copy.statusIdle;
  });
  runButton.addEventListener("click", runAnalysis);
  clearButton.addEventListener("click", clearImageAndResults);
  exportJsonButton.addEventListener("click", exportMeasurements);
  exportOverlayButton.addEventListener("click", exportOverlay);
  form.addEventListener("reset", () => window.setTimeout(() => {
    clearImageAndResults();
    status.textContent = copy.statusIdle;
  }, 0));
  window.addEventListener("pagehide", () => {
    cancelWorker();
    offlineWorker?.terminate();
    offlineWorker = null;
    releaseImage();
    for (const url of downloadUrls) URL.revokeObjectURL(url);
    downloadUrls.clear();
  });

  updateControls();
}

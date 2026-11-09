import { isValidQuadrilateral, type ImagePoint, type PhotoAnalysisResult } from "../../tools/photo-analysis.mjs";
import type { WorksheetMarkerResult, WorksheetWritingResult } from "../../tools/worksheet-analysis.mjs";

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

type StoredAnalysis = Omit<PhotoAnalysisResult, "preview" | "mask"> & WorksheetAnalysisDetails;
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
  const expectedTextInput = container.querySelector<HTMLInputElement>("[data-analysis-expected-text]");
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
  if (!form || !imageInput || !worksheetInput || !worksheetReferenceStatus || !worksheetResultOutput || !expectedTextInput || !modelSelect || !imageFrame || !preview || !cropOverlay || !cropPolygon || !status || !resetCropButton || !runButton || !clearButton || !exportJsonButton || !exportOverlayButton || !results || !analysisContext || !lineCount || !deskewOutput || !thresholdOutput || !foregroundOutput || !lineSpacingOutput || !lineList || !rectifiedCanvas || !maskCanvas || !overlayCanvas || cornerHandles.length !== 4) return;

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

  const format = new Intl.NumberFormat(document.documentElement.lang, { maximumFractionDigits: 1 });

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
    if (worker || !results.hidden) {
      cancelWorker();
      clearResults();
      status.textContent = copy.statusIdle;
    }
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
      },
      imageDimensions: { inputWidth: imageWidth, inputHeight: imageHeight, rectifiedWidth: latestAnalysis.width, rectifiedHeight: latestAnalysis.height },
      metrics: latestAnalysis,
      unavailable: { wordGaps: { available: false, reasonCode: "no_ocr_or_word_segmentation" } },
      limitations: ["no_ocr", "no_model_scoring", "baseline_is_low_confidence_lower_ink_envelope", "worksheet_measurements_require_a_matching_local_svg_and_confident_markers", ...(latestAnalysis.worksheetGeometry?.status === "recognized" ? [] : ["measurements_depend_on_manual_crop"])],
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

  const displayResult = (message: ResultMessage) => {
    const previewPixels = new Uint8ClampedArray(message.preview);
    const mask = new Uint8Array(message.mask);
    latestAnalysis = {
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
        displayResult(data);
        status.textContent = copy.statusComplete;
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

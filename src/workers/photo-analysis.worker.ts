// SPDX-License-Identifier: Apache-2.0
import { analyzePixels, type ImagePoint } from "../../tools/photo-analysis.mjs";
import { analyzeWorksheetWriting, detectWorksheetGeometry } from "../../tools/worksheet-analysis.mjs";
import type { WorksheetMarkerResult, WorksheetWritingResult } from "../../tools/worksheet-analysis.mjs";

interface AnalyzeRequest {
  type: "analyze";
  requestId: number;
  file: File;
  corners: ImagePoint[];
  worksheetMetadata?: unknown;
}

interface PrepareRequest {
  type: "prepare";
}

type WorkerRequest = AnalyzeRequest | PrepareRequest;

interface WorkerScope {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
  postMessage(message: unknown, transfer?: Transferable[]): void;
}

const workerScope = self as WorkerScope;
const maxInputPixels = 18_000_000;

workerScope.onmessage = async ({ data }) => {
  if (data.type === "prepare") {
    workerScope.postMessage({ type: "prepared" });
    return;
  }
  let bitmap: ImageBitmap | null = null;
  try {
    workerScope.postMessage({ type: "progress", requestId: data.requestId, stage: "decode" });
    bitmap = await createImageBitmap(data.file, { imageOrientation: "from-image" });
    if (bitmap.width * bitmap.height > maxInputPixels) throw new Error("Image dimensions exceed the local processing limit.");

    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Local image processing is unavailable in this browser.");
    context.fillStyle = "white";
    context.fillRect(0, 0, bitmap.width, bitmap.height);
    context.drawImage(bitmap, 0, 0);
    const rgba = context.getImageData(0, 0, bitmap.width, bitmap.height).data;
    bitmap.close();
    bitmap = null;

    workerScope.postMessage({ type: "progress", requestId: data.requestId, stage: "geometry" });
    const worksheetGeometry: WorksheetMarkerResult | null = data.worksheetMetadata
      ? detectWorksheetGeometry(rgba, canvas.width, canvas.height, data.worksheetMetadata)
      : null;
    const calibratedCorners = worksheetGeometry?.status === "recognized" && worksheetGeometry.pageCorners && worksheetGeometry.pageSizeMm
      ? worksheetGeometry.pageCorners
      : null;
    const result = analyzePixels(
      rgba,
      canvas.width,
      canvas.height,
      calibratedCorners ?? data.corners,
      calibratedCorners && worksheetGeometry?.pageSizeMm
        ? { targetSizeMm: worksheetGeometry.pageSizeMm, skipDeskew: true }
        : undefined,
    );
    const worksheetWriting: WorksheetWritingResult | null = calibratedCorners && worksheetGeometry
      ? analyzeWorksheetWriting(result.mask, result.width, result.height, data.worksheetMetadata, worksheetGeometry.confidence)
      : null;
    workerScope.postMessage({
      type: "result",
      requestId: data.requestId,
      ...result,
      worksheetGeometry,
      worksheetWriting,
      preview: result.preview.buffer,
      mask: result.mask.buffer,
    }, [result.preview.buffer, result.mask.buffer]);
  } catch (error) {
    workerScope.postMessage({
      type: "error",
      requestId: data.requestId,
      message: error instanceof Error ? error.message : "Local image processing failed.",
    });
  } finally {
    bitmap?.close();
  }
};

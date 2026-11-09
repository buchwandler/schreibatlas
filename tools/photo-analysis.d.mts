export interface ImagePoint {
  x: number;
  y: number;
}

export interface BaselineCandidate {
  y: number;
  slopeDegrees: number;
  residualStdDev: number;
  source: "lower-ink-envelope";
  confidence: "low";
}

export interface DetectedLine {
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
  inkPixels: number;
  baselineCandidate: BaselineCandidate;
}

export interface PhotoAnalysisResult {
  width: number;
  height: number;
  preview: Uint8ClampedArray;
  mask: Uint8Array;
  threshold: number | null;
  deskewDegrees: number;
  deskewConfidence: "low" | "medium";
  foregroundPixels: number;
  lines: DetectedLine[];
  lineSpacing: number[];
}

export function isValidQuadrilateral(corners: ImagePoint[], width: number, height: number): boolean;
export function analyzePixels(rgba: Uint8ClampedArray, width: number, height: number, corners: ImagePoint[], options?: { targetSizeMm?: { width: number; height: number }; skipDeskew?: boolean }): PhotoAnalysisResult;

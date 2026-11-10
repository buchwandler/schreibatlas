// SPDX-License-Identifier: Apache-2.0
import type { ImagePoint } from "./photo-analysis.mjs";

export interface WorksheetMarkerResult {
  status: "recognized" | "low-confidence" | "unavailable";
  confidence: number;
  reason: string | null;
  worksheetId: string | null;
  pageCorners?: ImagePoint[] | null;
  markers?: { code: number; x: number; y: number; confidence: number }[];
  candidateCount?: number;
  pageSizeMm?: { width: number; height: number };
}

export interface WorksheetWritingResult {
  status: "measured" | "unavailable";
  reason?: string;
  calibrationConfidence?: number;
  rows: Record<string, unknown>[];
  multiLineDiagnostics?: { measuredRows: number; baselineOffsetSpreadMm: number | null };
  repeatedLetterAnalysis: Record<string, unknown>;
  qualityRating?: null;
}

export function homographyFromPoints(source: ImagePoint[], target: ImagePoint[]): number[] | null;
export function applyHomography(transform: number[], point: ImagePoint): ImagePoint | null;
export function detectWorksheetGeometry(rgba: Uint8ClampedArray, width: number, height: number, metadata: unknown): WorksheetMarkerResult;
export function worksheetWritingRegions(metadata: unknown, width: number, height: number): Record<string, number | string>[];
export function clusterRepeatedShapes(shapes: Record<string, unknown>[], threshold?: number): Record<string, unknown>;
export function fitConstrainedSimilarity(referencePoints: ImagePoint[], samplePoints: ImagePoint[], limits?: {
  minScale?: number;
  maxScale?: number;
  maxRotationDegrees?: number;
  maxTranslation?: number;
  maxResidual?: number;
}): Record<string, unknown>;
export function analyzeWorksheetWriting(mask: Uint8Array, width: number, height: number, metadata: unknown, geometryConfidence: number): WorksheetWritingResult;

// SPDX-License-Identifier: Apache-2.0
export interface WritingSample {
  x: number;
  y: number;
  t: number;
  pressure?: number;
  pointerType: string;
  penDown: boolean;
}

export interface CaptureMetrics {
  strokeCount: number;
  sampleCount: number;
  pressureSampleCount: number;
  pathLength: number;
  width: number;
  height: number;
  durationMs: number;
  bounds: { minX: number; minY: number; maxX: number; maxY: number } | null;
}

export function splitCaptureStrokes(samples: WritingSample[]): WritingSample[][];
export function measureCapture(samples: WritingSample[]): CaptureMetrics;

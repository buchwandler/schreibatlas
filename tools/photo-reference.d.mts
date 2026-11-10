// SPDX-License-Identifier: Apache-2.0
export type PhotoReferenceConfidence = "high" | "medium" | "low" | "unavailable";

export interface PhotoReferenceLine {
  text: string;
  inkLeft: number;
  inkRight: number;
  ascent: number;
  descent: number;
  baseline: number;
  wordBoundaries?: { center: number; width: number }[];
}

export interface PhotoReferenceFit {
  available: boolean;
  reason: string | null;
  confidence: PhotoReferenceConfidence;
  residual: number | null;
  transform: {
    kind: "bounded-axis-scale-translation";
    scaleX: number;
    scaleY: number;
    translateX: number;
    translateY: number;
    rotationDegrees: 0;
    shear: 0;
  } | null;
}

export function fitReferenceText(referenceLines: PhotoReferenceLine[], observedLines: { x: number; y: number; width: number; height: number }[]): PhotoReferenceFit;

export function measureReferenceWordSpacing(
  referenceLines: PhotoReferenceLine[],
  observedLines: { x: number; y: number; width: number; height: number }[],
  mask: Uint8Array,
  width: number,
  height: number,
  fit: PhotoReferenceFit,
): {
  available: boolean;
  reason: string | null;
  value?: number;
  unit?: string;
  confidence: PhotoReferenceConfidence;
  referenceUsed: boolean;
  method?: string;
  observations: { line: number; boundary: number; expectedGapPx: number; observedGapPx: number; centerOffsetPx: number; ratio: number }[];
  limitations?: string[];
};

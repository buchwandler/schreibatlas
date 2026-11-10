// SPDX-License-Identifier: Apache-2.0
export type MovementObservationStatus = "match" | "different" | "uncertain" | "unavailable";

export interface MovementObservation {
  status: MovementObservationStatus;
  confidence: number | null;
  error: number | null;
  reason?: string;
  expected?: number;
  observed?: number;
}

export interface MovementComparisonResult {
  available: boolean;
  reason: string | null;
  alignment: {
    kind: "uniform-scale-translation";
    scale: number;
    translation?: { x: number; y: number };
    rotationDegrees: 0;
    shear: 0;
  } | null;
  observations: Record<"start" | "direction" | "order" | "penLifts" | "rhythm", MovementObservation>;
}

export interface ReferenceMovementStroke {
  penDown: boolean;
  points: { x: number; y: number }[];
  timingMs: number | null;
}

export function compareVerifiedStrokes(
  reference: { verification: string; sources: string[]; strokes: ReferenceMovementStroke[] } | null,
  capturedStrokes: ({ x: number; y: number; t: number }[])[] | null,
): MovementComparisonResult;

// SPDX-License-Identifier: Apache-2.0
export interface WorksheetSettings {
  version: 1;
  model: string;
  paper: "A4" | "Letter";
  marginMm: 8 | 12 | 16;
  rowHeightMm: 16 | 18 | 20;
  guides: "none" | "baseline" | "baseline-xheight";
  text: string;
  referenceRow: boolean;
  tracingRows: 0 | 1 | 2;
  blankRows: 1 | 2;
  repetitions: 1 | 2;
}

export interface WorksheetMarkerPosition {
  code: 1 | 2 | 3 | 4;
  corner: "top-left" | "top-right" | "bottom-right" | "bottom-left";
  x: number;
  y: number;
}

export const worksheetPapers: Record<WorksheetSettings["paper"], { width: number; height: number }>;
export const worksheetMarker: { format: "schreibatlas-fiducial"; version: 1; sizeMm: number; insetMm: number; moduleCount: 2 };
export function worksheetMarkerLayout(width: number, height: number): WorksheetMarkerPosition[];
export const worksheetPresets: { id: string; model: string; text: string }[];
export function worksheetId(settings: WorksheetSettings, datasetVersion: string): string;
export const worksheetDefaults: Omit<WorksheetSettings, "version" | "model">;
export function normalizeWorksheetSettings(value: unknown, modelIds?: string[], fallbackModel?: string): WorksheetSettings;
export function encodeWorksheetSettings(settings: WorksheetSettings): string;
export function decodeWorksheetSettings(fragment: string, modelIds?: string[], fallbackModel?: string): WorksheetSettings | null;
export function layoutWorksheet(settings: WorksheetSettings): {
  width: number;
  height: number;
  headerHeight: number;
  firstRowY: number;
  rowCapacity: number;
  rows: { kind: "reference" | "trace" | "blank"; repetition: number; number: number; top: number; baseline: number; xHeight: number }[];
};

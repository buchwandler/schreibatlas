// SPDX-License-Identifier: Apache-2.0
export function appendWorksheetMetadataToPng(png: Uint8Array, metadata: Record<string, unknown>): Uint8Array;

export interface WorksheetPdfInput {
  pageWidthMm: number;
  pageHeightMm: number;
  pixelWidth: number;
  pixelHeight: number;
  rgb: Uint8Array;
  metadata: Record<string, unknown>;
}

export function createWorksheetPdf(input: WorksheetPdfInput): Promise<Uint8Array>;

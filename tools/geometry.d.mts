// SPDX-License-Identifier: Apache-2.0
import type { GlyphOutline } from "./content.d.mts";

export interface NormalizedBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface NormalizedOutline {
  transform: string;
  bounds: NormalizedBounds;
}

export interface SharedViewBox {
  x: number;
  y: number;
  width: number;
  height: number;
  world: NormalizedBounds;
}

export function fontSizeForXHeight(xHeightEm: number): number;
export function normalizePoint(outline: GlyphOutline, x: number, y: number): { x: number; y: number };
export function normalizeOutline(outline: GlyphOutline): NormalizedOutline;
export function sharedViewBox(normalizedOutlines: NormalizedOutline[], metrics?: Pick<import("./content.d.mts").Metrics, "ascender" | "descender">[]): SharedViewBox;

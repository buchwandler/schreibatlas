// SPDX-License-Identifier: Apache-2.0
import type { FontRecord } from "../../tools/content.mjs";

export function codePointLabelToCharacter(value: string): string {
  const point = Number.parseInt(value.slice(2), 16);
  return String.fromCodePoint(point);
}

export function shapeReferenceWord(value: string, font: Pick<FontRecord, "shaping">): string {
  const boundary = font.shaping?.word_boundary;
  if (!boundary) return value;

  const start = codePointLabelToCharacter(boundary.start);
  const end = codePointLabelToCharacter(boundary.end);
  if (value.includes(start) || value.includes(end)) {
    throw new Error("Word-boundary markers are reserved and cannot appear in reference text.");
  }

  return `${start}${value}${end}`;
}

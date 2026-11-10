// SPDX-License-Identifier: Apache-2.0
export function unicodeCodePoints(value) {
  return Array.from(value, (character) => {
    const hex = character.codePointAt(0).toString(16).toUpperCase().padStart(4, "0");
    return `U+${hex}`;
  });
}

export function glyphFileName(value) {
  return `${unicodeCodePoints(value).map((codePoint) => codePoint.slice(2)).join("-")}.yaml`;
}

export function glyphRouteSlug(value) {
  return `u${unicodeCodePoints(value).map((codePoint) => codePoint.slice(2).toLowerCase()).join("-")}`;
}

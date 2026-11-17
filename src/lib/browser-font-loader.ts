// SPDX-License-Identifier: Apache-2.0

export class UnsupportedFontFeaturesError extends Error {
  constructor() {
    super("Required OpenType features are not supported by this browser.");
    this.name = "UnsupportedFontFeaturesError";
  }
}

const fontLoads = new Map<string, Promise<FontFace>>();

export function loadLocalReferenceFont(options: {
  fontId: string;
  family: string;
  urls: string[];
  requiredFeatures?: string[];
}): Promise<FontFace> {
  const key = JSON.stringify([options.fontId, options.family]);
  const cached = fontLoads.get(key);
  if (cached) return cached;

  const loading = (async () => {
    if (options.urls.length === 0) throw new Error("A local reference font URL is required.");
    const sources = options.urls.map((value) => {
      const url = new URL(value, window.location.href);
      if (url.origin !== window.location.origin || url.username || url.password) {
        throw new Error("Reference font URLs must be same-origin.");
      }
      return `url(${JSON.stringify(url.href)})`;
    }).join(", ");
    const featureSettings = (options.requiredFeatures ?? []).map((feature) => `"${feature}" 1`).join(", ");
    if (featureSettings && !CSS.supports("font-feature-settings", featureSettings)) {
      throw new UnsupportedFontFeaturesError();
    }

    const face = await new FontFace(options.family, sources).load();
    document.fonts.add(face);
    return face;
  })();
  fontLoads.set(key, loading);
  return loading;
}

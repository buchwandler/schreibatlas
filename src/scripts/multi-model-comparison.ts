// SPDX-License-Identifier: Apache-2.0
import type { FontRecord, GlyphRecord } from "../../tools/content.mjs";
import { normalizeOutline } from "../../tools/geometry.mjs";
import { appendFontProvenance, fontFeatureSettings, supportsRequiredFontFeatures } from "../lib/font-capabilities";

interface MultiModel {
  id: string; name: string; country: string | null; languages: string[];
  joined: boolean | null; characters: string[]; glyphs: GlyphRecord[]; url: string; capability: string;
  font?: FontRecord & { url: string; supported: string[]; provenanceUrl?: string };
}
const root = document.querySelector<HTMLElement>("[data-multi-comparison]");
if (root) {
  const models = JSON.parse(root.querySelector("[data-multi-data]")!.textContent!) as MultiModel[];
  const lang = root.dataset.lang!;
  const de = lang === "de";
  const character = root.querySelector<HTMLInputElement>("[data-multi-character]")!;
  const mode = root.querySelector<HTMLSelectElement>("[data-multi-mode]")!;
  const opacity = root.querySelector<HTMLInputElement>("[data-multi-opacity]")!;
  const checks = [...root.querySelectorAll<HTMLInputElement>("[data-multi-option] input")];
  const filters = [...root.querySelectorAll<HTMLSelectElement>("[data-multi-filter]")];
  const status = root.querySelector<HTMLElement>("[data-multi-status]")!;
  const stage = root.querySelector<HTMLElement>("[data-multi-stage]")!;
  const share = root.querySelector<HTMLInputElement>("[data-multi-share]")!;
  const loaded = new Map<string, Promise<FontFace>>();
  const colors = ["#235b83", "#a44635", "#267449", "#6b4698", "#805500", "#285c66"];
  const namespace = "http://www.w3.org/2000/svg";
  let generation = 0;
  const params = new URL(location.href).searchParams;
  if (params.has("nmodels")) for (const check of checks) check.checked = params.get("nmodels")!.split(",").includes(check.value);
  character.value = params.get("nchar") ?? "r";
  mode.value = ["grid", "strip", "overlay"].includes(params.get("nmode") ?? "") ? params.get("nmode")! : "grid";
  for (const filter of filters) filter.value = params.get(`n${filter.dataset.multiFilter}`) ?? "";
  if (params.has("nopacity")) opacity.value = params.get("nopacity")!;

  function svgElement(name: string, attributes: Record<string, string>) {
    const node = document.createElementNS(namespace, name);
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
    return node;
  }
  function newFigure() {
    const figure = document.createElement("figure");
    const svg = svgElement("svg", { viewBox: "-1 -3 6 5", role: "img", "aria-label": character.value });
    for (const y of [0, -1]) svg.append(svgElement("line", { x1: "-1", x2: "5", y1: String(y), y2: String(y), stroke: "#64748b", "stroke-width": "0.01", "data-guide": y === 0 ? "baseline" : "x-height" }));
    figure.append(svg);
    const caption = document.createElement("figcaption");
    figure.append(caption);
    return { figure, svg, caption };
  }
  function matching(model: MultiModel) {
    return filters.every((filter) => !filter.value || (filter.dataset.multiFilter === "country" ? model.country === filter.value : filter.dataset.multiFilter === "language" ? model.languages.includes(filter.value) : String(model.joined) === filter.value));
  }
  async function render() {
    const current = ++generation;
    stage.replaceChildren();
    status.textContent = "";
    const selected = models.filter((model) => matching(model) && checks.some((check) => check.checked && check.value === model.id));
    for (const check of checks) check.closest<HTMLElement>("label")!.hidden = !matching(models.find((model) => model.id === check.value)!);
    const url = new URL(location.href);
    url.searchParams.set("nmodels", checks.filter((check) => check.checked).map((check) => check.value).join(","));
    url.searchParams.set("nchar", character.value);
    url.searchParams.set("nmode", mode.value);
    url.searchParams.set("nopacity", opacity.value);
    for (const filter of filters) {
      const key = `n${filter.dataset.multiFilter}`;
      if (filter.value) url.searchParams.set(key, filter.value); else url.searchParams.delete(key);
    }
    share.value = url.href;
    if (selected.length < 2 || selected.length > 6 || (mode.value === "overlay" && selected.length > 3)) {
      status.textContent = de ? "Bitte 2–6 Modelle wählen; für Überlagerung höchstens 3." : "Select 2–6 models; overlay allows at most 3.";
      return;
    }
    const segments = [...new Intl.Segmenter(lang, { granularity: "grapheme" }).segment(character.value)];
    if (segments.length !== 1) { status.textContent = de ? "Bitte genau ein Zeichen eingeben." : "Enter exactly one character."; return; }
    stage.dataset.mode = mode.value;
    const overlay = mode.value === "overlay" ? newFigure() : null;
    for (const [index, model] of selected.entries()) {
      const target = overlay ?? newFigure();
      const link = document.createElement("a");
      link.href = model.url;
      link.textContent = model.name;
      target.caption.append(link, " · ");
      const glyph = model.glyphs.find((glyph) => glyph.character === character.value);
      const font = model.font;
      if (glyph?.outline) {
        const group = svgElement("g", { transform: "scale(1 -1)" });
        group.append(svgElement("path", { d: glyph.outline.path, transform: normalizeOutline(glyph.outline).transform, fill: colors[index], "fill-rule": glyph.outline.fill_rule ?? "nonzero", opacity: mode.value === "overlay" ? opacity.value : "1" }));
        target.svg.append(group);
        target.caption.append(`${de ? "Erfasste Kontur" : "Recorded outline"} · ${glyph.verification} · ${glyph.license} · ${glyph.sources.join(", ")}. `);
      } else if (font?.calibration && font.supported.includes(character.value)) {
        const features = font.shaping?.required_features ?? [];
        const featureSettings = fontFeatureSettings(font);
        target.caption.append(`${de ? "Referenzfont" : "Reference font"}: ${font.name} · ${font.font_version ?? ""} · ${font.correspondence.degree} · ${font.license} · OpenType: ${features.join(", ") || (de ? "Funktionen nicht dokumentiert" : "features not documented")}. `);
        appendFontProvenance(target.caption, font, de ? "de" : "en", font.provenanceUrl);
        if (!supportsRequiredFontFeatures(font)) {
          target.caption.append(de ? "Erforderliche OpenType-Funktionen nicht verfügbar; keine Ersatzschrift wird verwendet." : "Required OpenType features are unavailable; no substitute font is used.");
        } else {
          try {
            const family = `multi-${font.id}`;
            if (!loaded.has(font.id)) loaded.set(font.id, new FontFace(family, `url("${font.url}")`).load().then((face) => { document.fonts.add(face); return face; }));
            await loaded.get(font.id);
            if (current !== generation) return;
            const text = svgElement("text", { x: "0", y: "0", "font-family": family, "font-size": String(1 / font.calibration.x_height_em), fill: colors[index], opacity: mode.value === "overlay" ? opacity.value : "1", lang: font.shaping?.language_tag ?? lang, direction: font.shaping?.direction ?? "ltr" });
            text.style.fontFeatureSettings = featureSettings;
            text.textContent = character.value;
            target.svg.append(text);
          } catch {
            target.caption.append(de ? "Darstellung nicht verfügbar; es wird keine Ersatzschrift verwendet. " : "Rendering unavailable; no substitute font is used. ");
          }
        }
      } else if (font?.calibration) {
        target.caption.append(de ? "Die Referenzschrift deckt dieses Zeichen nicht ab; es wird keine Ersatzschrift verwendet. " : "The reference font does not cover this character; no substitute font is used. ");
        appendFontProvenance(target.caption, font, de ? "de" : "en", font.provenanceUrl);
      } else target.caption.append(de ? "Darstellung nicht verfügbar. " : "Rendering unavailable. ");
      if (!overlay) stage.append(target.figure);
    }
    if (overlay) stage.append(overlay.figure);
    status.textContent = `${selected.length} ${de ? "Modelle" : "models"} · ${character.value}`;
  }
  root.addEventListener("input", () => { void render(); });
  root.addEventListener("change", () => { void render(); });
  for (const button of root.querySelectorAll<HTMLButtonElement>("[data-multi-case]")) button.addEventListener("click", () => {
    character.value = button.dataset.multiCase === "upper" ? character.value.toLocaleUpperCase(lang) : character.value.toLocaleLowerCase(lang);
    void render();
  });
  void render();
}

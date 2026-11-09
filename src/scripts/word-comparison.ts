import { renderNormalizedTextStage } from "../lib/normalized-text-stage";
import { BrowserTextShaper } from "../lib/text-shaper";
import type { FontRecord, Metrics, SourceRecord } from "../../tools/content.mjs";

interface WordModel {
  id: string;
  name: string;
  languages: string[];
  reference_fonts: string[];
  metrics: Metrics | null;
}

interface WordLanguage {
  id: string;
  name: string;
  direction: string;
}

interface FontExport extends FontRecord {
  file_urls?: string[];
}

interface WordPageData {
  models: WordModel[];
  languages: WordLanguage[];
}

interface Messages {
  sideBySide: string;
  overlay: string;
  fontDegree: Record<string, string>;
  wordNoFont: string;
  wordNoCalibration: string;
  wordNoFiles: string;
  wordEmptyText: string;
  wordLoadError: string;
  wordLoading: string;
  wordSummary: string;
  wordPreview: string;
  wordFontLimitations: string;
  wordShapingNotice: string;
  licenseAttribution: string;
  sources: string;
  noSources: string;
  sourceAuthor: string;
  sourceYear: string;
  sourcePages: string;
  sourceNotes: string;
  sourceOpen: string;
  fontCorrespondence: string;
}

const page = document.querySelector<HTMLElement>("[data-word-comparison]");

if (page) {
  const data = JSON.parse(document.querySelector("#word-data")?.textContent ?? "{}") as WordPageData;
  const messages = JSON.parse(document.querySelector("#word-messages")?.textContent ?? "{}") as Messages;
  const modelById = new Map(data.models.map((model) => [model.id, model]));
  const languageById = new Map(data.languages.map((language) => [language.id, language]));
  const input = page.querySelector<HTMLTextAreaElement>("#word-input")!;
  const modelASelect = page.querySelector<HTMLSelectElement>("#word-model-a")!;
  const modelBSelect = page.querySelector<HTMLSelectElement>("#word-model-b")!;
  const fontASelect = page.querySelector<HTMLSelectElement>("#word-font-a")!;
  const fontBSelect = page.querySelector<HTMLSelectElement>("#word-font-b")!;
  const modeSelect = page.querySelector<HTMLSelectElement>("#word-mode")!;
  const opacityInput = page.querySelector<HTMLInputElement>("#word-opacity")!;
  const opacityOutput = page.querySelector<HTMLOutputElement>("#word-opacity-value")!;
  const baselineInput = page.querySelector<HTMLInputElement>("#word-baseline")!;
  const xHeightInput = page.querySelector<HTMLInputElement>("#word-x-height")!;
  const preview = page.querySelector<HTMLElement>("#word-literal-preview")!;
  const status = page.querySelector<HTMLElement>("#word-status")!;
  const summary = page.querySelector<HTMLElement>("#word-summary")!;
  const stage = page.querySelector<HTMLElement>("#word-stage")!;
  const provenance = page.querySelector<HTMLElement>("#word-provenance")!;
  const fontById = new Map<string, FontExport>();
  const sourceById = new Map<string, SourceRecord>();
  const familyByFontId = new Map<string, string>();
  const loadedFonts = new Map<string, FontExport>();
  const shaper = new BrowserTextShaper(familyByFontId);
  let renderVersion = 0;

  function addOption(select: HTMLSelectElement, value: string, label: string) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    select.append(option);
  }

  function localUrl(url: string) {
    const resolved = new URL(url, location.href);
    if (resolved.origin !== location.origin) throw new Error("Word comparison data must stay on this site.");
    return resolved.href;
  }

  function updateFontSelect(select: HTMLSelectElement, modelId: string) {
    const model = modelById.get(modelId);
    const preferred = select.value;
    const fonts = (model?.reference_fonts ?? []).flatMap((id) => {
      const font = fontById.get(id);
      return font && font.correspondence.model === modelId ? [font] : [];
    });
    select.replaceChildren();
    select.disabled = fonts.length === 0;
    if (fonts.length === 0) {
      addOption(select, "", messages.wordNoFont);
      return;
    }
    for (const font of fonts) {
      const degree = messages.fontDegree[font.correspondence.degree] ?? font.correspondence.degree;
      addOption(select, font.id, `${font.name} (${degree})`);
    }
    select.value = fonts.some((font) => font.id === preferred) ? preferred : fonts[0].id;
  }

  function renderProvenance(fonts: FontExport[]) {
    provenance.replaceChildren();
    const uniqueFonts = [...new Map(fonts.map((font) => [font.id, font])).values()];
    for (const font of uniqueFonts) {
      const card = document.createElement("section");
      card.className = "comparison-provenance-card";
      const heading = document.createElement("h2");
      heading.textContent = font.name;
      card.append(heading);
      const statusLine = document.createElement("p");
      const degree = messages.fontDegree[font.correspondence.degree] ?? font.correspondence.degree;
      statusLine.textContent = `${messages.fontCorrespondence}: ${degree}${font.correspondence.notes ? ` · ${font.correspondence.notes}` : ""}`;
      card.append(statusLine);
      const licenseLine = document.createElement("p");
      licenseLine.textContent = `${messages.licenseAttribution}: ${font.license}`;
      card.append(licenseLine);
      const sourceRecords = font.sources.flatMap((id) => sourceById.has(id) ? [sourceById.get(id)!] : []);
      if (sourceRecords.length === 0) {
        const empty = document.createElement("p");
        empty.textContent = messages.noSources;
        card.append(empty);
      } else {
        const list = document.createElement("ul");
        for (const source of sourceRecords) {
          const item = document.createElement("li");
          const details = [source.title];
          if (source.author.length) details.push(`${messages.sourceAuthor}: ${source.author.join(", ")}`);
          if (source.year !== null) details.push(`${messages.sourceYear}: ${source.year}`);
          const pages = source.locator?.pages;
          if (pages?.length) details.push(`${messages.sourcePages}: ${pages.join(", ")}`);
          if (source.notes) details.push(`${messages.sourceNotes}: ${source.notes}`);
          item.textContent = details.join(" · ");
          const sourceUrl = source.url;
          if (sourceUrl && (sourceUrl.startsWith("https://") || sourceUrl.startsWith("http://"))) {
            const link = document.createElement("a");
            link.href = sourceUrl;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            link.textContent = messages.sourceOpen;
            item.append(" ", link);
          }
          list.append(item);
        }
        card.append(list);
      }
      provenance.append(card);
    }
  }

  async function loadFont(font: FontExport) {
    const loaded = loadedFonts.get(font.id);
    if (loaded) return loaded;
    if (!font.file_urls?.length) throw new Error(messages.wordNoFiles);
    const family = `schreibatlas-${font.id}`;
    const sources = font.file_urls.map((url) => `url("${localUrl(url)}")`).join(", ");
    const face = await new FontFace(family, sources).load();
    document.fonts.add(face);
    familyByFontId.set(font.id, family);
    loadedFonts.set(font.id, font);
    return font;
  }

  function formatSummary(modelA: WordModel, modelB: WordModel) {
    return messages.wordSummary
      .replaceAll("{modelA}", modelA.name)
      .replaceAll("{modelB}", modelB.name);
  }

  async function renderComparison() {
    const version = ++renderVersion;
    const text = input.value;
    preview.textContent = text || messages.wordEmptyText;
    stage.replaceChildren();
    provenance.replaceChildren();
    summary.textContent = "";
    if (!text.trim()) {
      status.textContent = messages.wordEmptyText;
      return;
    }

    const modelA = modelById.get(modelASelect.value);
    const modelB = modelById.get(modelBSelect.value);
    const fontA = fontById.get(fontASelect.value);
    const fontB = fontById.get(fontBSelect.value);
    if (!modelA || !modelB || !fontA || !fontB) {
      status.textContent = messages.wordNoFont;
      return;
    }
    summary.textContent = formatSummary(modelA, modelB);
    renderProvenance([fontA, fontB]);
    if (!fontA.file_urls?.length || !fontB.file_urls?.length) {
      status.textContent = messages.wordNoFiles;
      return;
    }
    if (!fontA.calibration || !fontB.calibration) {
      status.textContent = messages.wordNoCalibration;
      return;
    }
    status.textContent = messages.wordLoading;
    try {
      await Promise.all([loadFont(fontA), loadFont(fontB)]);
      const languageA = languageById.get(modelA.languages[0] ?? "");
      const languageB = languageById.get(modelB.languages[0] ?? "");
      const [runA, runB] = await Promise.all([
        shaper.shape({ text, fontId: fontA.id, language: languageA?.id, direction: languageA?.direction === "rtl" ? "rtl" : "ltr" }),
        shaper.shape({ text, fontId: fontB.id, language: languageB?.id, direction: languageB?.direction === "rtl" ? "rtl" : "ltr" }),
      ]);
      if (version !== renderVersion) return;
      renderNormalizedTextStage(stage, [
        { run: runA, modelName: modelA.name, fontName: fontA.name, xHeightEm: fontA.calibration.x_height_em, metrics: modelA.metrics, color: "#235b83" },
        { run: runB, modelName: modelB.name, fontName: fontB.name, xHeightEm: fontB.calibration.x_height_em, metrics: modelB.metrics, color: "#a44635" },
      ], {
        mode: modeSelect.value === "overlay" ? "overlay" : "side-by-side",
        opacity: Math.min(1, Math.max(0.1, Number(opacityInput.value))),
        showBaseline: baselineInput.checked,
        showXHeight: xHeightInput.checked,
        overlayLabel: messages.overlay,
      });
      status.textContent = "";
    } catch {
      if (version !== renderVersion) return;
      stage.replaceChildren();
      status.textContent = messages.wordLoadError;
    }
  }

  async function initialize() {
    const dataUrl = page?.dataset.indexUrl;
    if (!dataUrl) return;
    if (data.models.length > 1) modelBSelect.selectedIndex = 1;
    updateFontSelect(fontASelect, modelASelect.value);
    updateFontSelect(fontBSelect, modelBSelect.value);
    opacityOutput.value = `${Math.round(Number(opacityInput.value) * 100)}%`;
    try {
      const indexResponse = await fetch(localUrl(dataUrl), { credentials: "same-origin" });
      if (!indexResponse.ok) throw new Error(`Index request failed with status ${indexResponse.status}.`);
      const index = await indexResponse.json() as { fonts: string; sources: string };
      const [fontResponse, sourceResponse] = await Promise.all([
        fetch(localUrl(index.fonts), { credentials: "same-origin" }),
        fetch(localUrl(index.sources), { credentials: "same-origin" }),
      ]);
      if (!fontResponse.ok || !sourceResponse.ok) throw new Error("Local font or source index request failed.");
      const [fonts, sources] = await Promise.all([fontResponse.json(), sourceResponse.json()]) as [FontExport[], SourceRecord[]];
      for (const font of fonts) fontById.set(font.id, font);
      for (const source of sources) sourceById.set(source.id, source);
      updateFontSelect(fontASelect, modelASelect.value);
      updateFontSelect(fontBSelect, modelBSelect.value);
      await renderComparison();
    } catch {
      status.textContent = messages.wordLoadError;
    }
  }

  modelASelect.addEventListener("change", () => {
    updateFontSelect(fontASelect, modelASelect.value);
    void renderComparison();
  });
  modelBSelect.addEventListener("change", () => {
    updateFontSelect(fontBSelect, modelBSelect.value);
    void renderComparison();
  });
  for (const control of [fontASelect, fontBSelect, modeSelect, opacityInput, baselineInput, xHeightInput]) {
    control.addEventListener(control === opacityInput ? "input" : "change", () => {
      if (control === opacityInput) opacityOutput.value = `${Math.round(Number(opacityInput.value) * 100)}%`;
      void renderComparison();
    });
  }
  input.addEventListener("input", () => void renderComparison());
  void initialize();
}

import { renderNormalizedGlyphStage } from "../lib/normalized-glyph-stage";
import type { GlyphRecord, ModelRecord, SourceRecord } from "../../tools/content.mjs";

interface GlyphIndexEntry {
  model: string;
  character: string;
  unicode: string[];
  slug: string;
  verification: string;
  url: string;
}

interface ComparisonModel {
  id: string;
  name: string;
  country: string | null;
  metrics: ModelRecord["metrics"];
}

interface ComparisonPageData {
  models: ComparisonModel[];
  countries: { id: string; name: string }[];
}

interface Messages {
  allCountries: string;
  loadingGlyphs: string;
  noComparableGlyphs: string;
  noVectorOutline: string;
  glyphLoadError: string;
  comparisonSummary: string;
  copySuccess: string;
  copyError: string;
  sources: string;
  noSources: string;
  licenseAttribution: string;
  sourceAuthor: string;
  sourceYear: string;
  sourcePages: string;
  sourceNotes: string;
  sourceOpen: string;
  verification: Record<string, { label: string; explanation: string }>;
  overlay: string;
}

interface ComparisonState {
  country: string;
  character: string;
  modelA: string;
  modelB: string;
  mode: "side-by-side" | "overlay";
  opacity: number;
  baseline: boolean;
  xHeight: boolean;
  bounds: boolean;
}

const page = document.querySelector<HTMLElement>("[data-letter-comparison]");

if (page) {
  const comparisonData = JSON.parse(document.querySelector("#comparison-data")?.textContent ?? "{}") as ComparisonPageData;
  const messages = JSON.parse(document.querySelector("#comparison-messages")?.textContent ?? "{}") as Messages;
  const modelById = new Map(comparisonData.models.map((model) => [model.id, model]));
  const characterSelect = page.querySelector<HTMLSelectElement>("#compare-character")!;
  const countrySelect = page.querySelector<HTMLSelectElement>("#compare-country")!;
  const modelASelect = page.querySelector<HTMLSelectElement>("#compare-model-a")!;
  const modelBSelect = page.querySelector<HTMLSelectElement>("#compare-model-b")!;
  const modeSelect = page.querySelector<HTMLSelectElement>("#compare-mode")!;
  const opacityInput = page.querySelector<HTMLInputElement>("#compare-opacity")!;
  const baselineInput = page.querySelector<HTMLInputElement>("#compare-baseline")!;
  const xHeightInput = page.querySelector<HTMLInputElement>("#compare-x-height")!;
  const boundsInput = page.querySelector<HTMLInputElement>("#compare-bounds")!;
  const opacityOutput = page.querySelector<HTMLOutputElement>("#compare-opacity-value")!;
  const stage = page.querySelector<HTMLElement>("#comparison-stage")!;
  const status = page.querySelector<HTMLElement>("#comparison-status")!;
  const summary = page.querySelector<HTMLElement>("#comparison-summary")!;
  const provenance = page.querySelector<HTMLElement>("#comparison-provenance")!;
  const shareUrl = page.querySelector<HTMLInputElement>("#comparison-share-url")!;
  const copyButton = page.querySelector<HTMLButtonElement>("#comparison-copy-link")!;
  const glyphCache = new Map<string, GlyphRecord>();
  const sourceById = new Map<string, SourceRecord>();
  let glyphIndex: GlyphIndexEntry[] = [];
  let renderVersion = 0;

  function selectedState(): ComparisonState {
    const opacity = Number(opacityInput.value);
    return {
      country: countrySelect.value,
      character: characterSelect.value,
      modelA: modelASelect.value,
      modelB: modelBSelect.value,
      mode: modeSelect.value === "overlay" ? "overlay" : "side-by-side",
      opacity: Number.isFinite(opacity) ? Math.min(1, Math.max(0.1, opacity)) : 0.5,
      baseline: baselineInput.checked,
      xHeight: xHeightInput.checked,
      bounds: boundsInput.checked,
    };
  }

  function initialState(): Partial<ComparisonState> {
    const params = new URLSearchParams(location.search);
    const opacity = Number(params.get("opacity"));
    return {
      country: params.get("country") ?? "",
      character: params.get("character") ?? "",
      modelA: params.get("modelA") ?? "",
      modelB: params.get("modelB") ?? "",
      mode: params.get("mode") === "overlay" ? "overlay" : "side-by-side",
      opacity: Number.isFinite(opacity) && opacity > 0 && opacity <= 1 ? opacity : 0.5,
      baseline: params.get("baseline") !== "0",
      xHeight: params.get("xheight") !== "0",
      bounds: params.get("bounds") === "1",
    };
  }

  function updateShareUrl() {
    const state = selectedState();
    const params = new URLSearchParams();
    if (state.country) params.set("country", state.country);
    if (state.character) params.set("character", state.character);
    if (state.modelA) params.set("modelA", state.modelA);
    if (state.modelB) params.set("modelB", state.modelB);
    if (state.mode === "overlay") params.set("mode", state.mode);
    if (state.opacity !== 0.5) params.set("opacity", String(state.opacity));
    if (!state.baseline) params.set("baseline", "0");
    if (!state.xHeight) params.set("xheight", "0");
    if (state.bounds) params.set("bounds", "1");
    const query = params.toString();
    const url = `${location.pathname}${query ? `?${query}` : ""}`;
    history.replaceState(null, "", url);
    shareUrl.value = location.href;
  }

  function addOption(select: HTMLSelectElement, value: string, label: string) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    select.append(option);
  }

  function entriesForCurrentCountry() {
    const country = countrySelect.value;
    return glyphIndex.filter((entry) => !country || modelById.get(entry.model)?.country === country);
  }

  function setModels(entries: GlyphIndexEntry[], state: Partial<ComparisonState>) {
    const ids = [...new Set(entries.map((entry) => entry.model))];
    for (const [select, preferred] of [[modelASelect, state.modelA], [modelBSelect, state.modelB]] as const) {
      select.replaceChildren();
      select.disabled = ids.length === 0;
      for (const id of ids) {
        const model = modelById.get(id);
        if (!model) continue;
        addOption(select, id, model.name);
      }
      const fallback = select === modelBSelect && ids.length > 1 ? ids[1] : ids[0];
      select.value = preferred && ids.includes(preferred) ? preferred : fallback ?? "";
    }
  }

  function setCharacters(state: Partial<ComparisonState>) {
    const entries = entriesForCurrentCountry();
    const characters = new Map<string, GlyphIndexEntry>();
    for (const entry of entries) if (!characters.has(entry.slug)) characters.set(entry.slug, entry);
    characterSelect.replaceChildren();
    characterSelect.disabled = characters.size === 0;
    if (characters.size === 0) {
      addOption(characterSelect, "", messages.noComparableGlyphs);
      setModels([], state);
      status.textContent = messages.noComparableGlyphs;
      return;
    }
    for (const [slug, entry] of characters) addOption(characterSelect, slug, `${entry.character} (${entry.unicode.join(", ")})`);
    characterSelect.value = state.character && characters.has(state.character) ? state.character : characters.keys().next().value ?? "";
    setModels(entries.filter((entry) => entry.slug === characterSelect.value), state);
    status.textContent = "";
  }

  function localUrl(url: string) {
    const resolved = new URL(url, location.href);
    if (resolved.origin !== location.origin) throw new Error("Glyph data URL is not local.");
    return resolved.href;
  }

  async function loadGlyph(entry: GlyphIndexEntry) {
    const url = localUrl(entry.url);
    const cached = glyphCache.get(url);
    if (cached) return cached;
    const response = await fetch(url, { credentials: "same-origin" });
    if (!response.ok) throw new Error(`Glyph request failed with status ${response.status}.`);
    const glyph = await response.json() as GlyphRecord;
    glyphCache.set(url, glyph);
    return glyph;
  }


  function renderProvenance(items: { glyph: GlyphRecord; model: ComparisonModel }[]) {
    provenance.replaceChildren();
    const uniqueItems = [...new Map(items.map((item) => [item.model.id, item])).values()];
    for (const { glyph, model } of uniqueItems) {
      const card = document.createElement("section");
      card.className = "comparison-provenance-card";
      const heading = document.createElement("h2");
      heading.textContent = model.name;
      card.append(heading);
      const verification = messages.verification[glyph.verification];
      const statusLine = document.createElement("p");
      statusLine.textContent = `${verification?.label ?? glyph.verification}: ${verification?.explanation ?? ""}`;
      card.append(statusLine);
      const licenseLine = document.createElement("p");
      licenseLine.textContent = `${messages.licenseAttribution}: ${glyph.license}`;
      card.append(licenseLine);
      const sources = (glyph.sources ?? []).flatMap((id) => sourceById.has(id) ? [sourceById.get(id)!] : []);
      if (sources.length === 0) {
        const empty = document.createElement("p");
        empty.textContent = messages.noSources;
        card.append(empty);
      } else {
        const list = document.createElement("ul");
        for (const source of sources) {
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

  function renderSvg(glyphs: { glyph: GlyphRecord; model: ComparisonModel; label: string; color: string }[], mode: ComparisonState["mode"], opacity: number) {
    renderNormalizedGlyphStage(stage, glyphs.map(({ glyph, model, label, color }) => ({
      outline: glyph.outline!,
      label,
      color,
      metrics: model.metrics,
    })), {
      mode,
      opacity,
      showBaseline: baselineInput.checked,
      showXHeight: xHeightInput.checked,
      showBounds: boundsInput.checked,
      overlayLabel: messages.overlay,
    });
  }

  async function renderComparison() {
    const version = ++renderVersion;
    updateShareUrl();
    const state = selectedState();
    const entries = entriesForCurrentCountry().filter((entry) => entry.slug === state.character);
    const entryA = entries.find((entry) => entry.model === state.modelA);
    const entryB = entries.find((entry) => entry.model === state.modelB);
    if (!entryA || !entryB) {
      stage.replaceChildren();
      summary.textContent = "";
      provenance.replaceChildren();
      return;
    }
    const modelA = modelById.get(entryA.model)!;
    const modelB = modelById.get(entryB.model)!;
    const replacements = { "{character}": entryA.character, "{modelA}": modelA.name, "{modelB}": modelB.name };
    summary.textContent = Object.entries(replacements).reduce((text, [key, value]) => text.replaceAll(key, value), messages.comparisonSummary);
    status.textContent = messages.loadingGlyphs;
    try {
      const [glyphA, glyphB] = await Promise.all([loadGlyph(entryA), loadGlyph(entryB)]);
      if (version !== renderVersion) return;
      renderProvenance([{ glyph: glyphA, model: modelA }, { glyph: glyphB, model: modelB }]);
      if (!glyphA.outline || !glyphB.outline) {
        stage.replaceChildren();
        status.textContent = messages.noVectorOutline;
        return;
      }
      const stateNow = selectedState();
      renderSvg([
        { glyph: glyphA, model: modelA, label: modelA.name, color: "#235b83" },
        { glyph: glyphB, model: modelB, label: modelB.name, color: "#a44635" },
      ], stateNow.mode, stateNow.opacity);
      status.textContent = "";
    } catch {
      if (version !== renderVersion) return;
      stage.replaceChildren();
      status.textContent = messages.glyphLoadError;
    }
  }

  async function initialize() {
    const dataUrl = page?.dataset.indexUrl;
    if (!dataUrl) return;
    const initial = initialState();
    modeSelect.value = initial.mode ?? "side-by-side";
    opacityInput.value = String(initial.opacity ?? 0.5);
    baselineInput.checked = initial.baseline ?? true;
    xHeightInput.checked = initial.xHeight ?? true;
    boundsInput.checked = initial.bounds ?? false;
    opacityOutput.value = `${Math.round(Number(opacityInput.value) * 100)}%`;
    countrySelect.replaceChildren();
    addOption(countrySelect, "", messages.allCountries);
    for (const country of comparisonData.countries) addOption(countrySelect, country.id, country.name);
    countrySelect.value = comparisonData.countries.some((country) => country.id === initial.country) ? initial.country! : "";

    try {
      const indexResponse = await fetch(localUrl(dataUrl), { credentials: "same-origin" });
      if (!indexResponse.ok) throw new Error(`Index request failed with status ${indexResponse.status}.`);
      const index = await indexResponse.json() as { glyphs: string; sources: string };
      const glyphResponse = await fetch(localUrl(index.glyphs), { credentials: "same-origin" });
      if (!glyphResponse.ok) throw new Error(`Glyph index request failed with status ${glyphResponse.status}.`);
      glyphIndex = await glyphResponse.json() as GlyphIndexEntry[];
      const sourcesResponse = await fetch(localUrl(index.sources), { credentials: "same-origin" });
      if (!sourcesResponse.ok) throw new Error(`Source request failed with status ${sourcesResponse.status}.`);
      const sources = await sourcesResponse.json() as SourceRecord[];
      sourceById.clear();
      for (const source of sources) sourceById.set(source.id, source);
      setCharacters(initial);
      await renderComparison();
    } catch {
      status.textContent = messages.glyphLoadError;
    }
  }

  countrySelect.addEventListener("change", () => {
    setCharacters({ character: characterSelect.value });
    void renderComparison();
  });
  characterSelect.addEventListener("change", () => {
    setModels(entriesForCurrentCountry().filter((entry) => entry.slug === characterSelect.value), {});
    void renderComparison();
  });
  for (const control of [modelASelect, modelBSelect, modeSelect, opacityInput, baselineInput, xHeightInput, boundsInput]) {
    control.addEventListener(control === opacityInput ? "input" : "change", () => {
      if (control === opacityInput) opacityOutput.value = `${Math.round(Number(opacityInput.value) * 100)}%`;
      void renderComparison();
    });
  }
  copyButton.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(shareUrl.value);
      status.textContent = messages.copySuccess;
    } catch {
      status.textContent = messages.copyError;
    }
  });

  void initialize();
}

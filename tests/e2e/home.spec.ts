import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { Buffer } from "node:buffer";
import { ModuleKind, ScriptTarget, transpileModule } from "typescript";

const strokeRendererSource = readFileSync(new URL("../../src/scripts/stroke-renderer.ts", import.meta.url), "utf8");
const { outputText: strokeRendererScript } = transpileModule(strokeRendererSource, { compilerOptions: { module: ModuleKind.ESNext, target: ScriptTarget.ES2022 } });

test("root offers direct German and English routes", async ({ page }) => {
  await page.goto("./");
  await expect(page.getByRole("heading", { name: "Schreibatlas", level: 1 })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Language / Sprache" }).getByRole("link", { name: "Deutsch" })).toHaveAttribute("href", /\/de\/$/);
  await expect(page.getByRole("navigation", { name: "Language / Sprache" }).getByRole("link", { name: "English" })).toHaveAttribute("href", /\/en\/$/);
});

test("German home exposes localized metadata and accessible navigation", async ({ page }) => {
  await page.goto("de/");
  await expect(page.locator("html")).toHaveAttribute("lang", "de");
  await expect(page.getByRole("heading", { name: "Handschriftmodelle offen erkunden", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Demo-Daten, keine verifizierten Standards" })).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://schreibatlas.de/de/");
  await expect(page.locator('link[hreflang="en"]')).toHaveAttribute("href", "https://schreibatlas.de/en/");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Zum Inhalt springen" })).toBeFocused();
});

test("English home is a direct localized route with language navigation", async ({ page }) => {
  await page.goto("en/");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("heading", { name: "Explore handwriting models openly", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Demo data, not verified standards" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Choose language" }).getByRole("link", { name: "Deutsch" })).toHaveAttribute("href", /\/de\/$/);
  await expect(page.locator('link[hreflang="de"]')).toHaveAttribute("href", "https://schreibatlas.de/de/");
});


test("explore filters the validated model records and links to source-backed detail", async ({ page }) => {
  await page.goto("de/explore/");
  await expect(page.locator("html")).toHaveAttribute("lang", "de");
  await expect(page.getByRole("heading", { name: "Handschriftmodelle", level: 1 })).toBeVisible();
  await expect(page.locator("[data-model-card]")).toHaveCount(3);
  await page.getByRole("searchbox", { name: "Modelle suchen" }).fill("Rundschrift");
  await expect(page.locator("[data-model-card]:visible")).toHaveCount(1);
  await page.getByRole("searchbox", { name: "Modelle suchen" }).fill("not-a-model");
  await expect(page.getByText("Keine Modelle passen zu den aktuellen Filtern.")).toBeVisible();

  await page.goto("de/models/demo-round/");
  await expect(page.getByRole("heading", { name: "Demo Rundschrift", level: 1 })).toBeVisible();
  await expect(page.getByText("Projektplatzhalter, kein fachlicher Beleg")).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://schreibatlas.de/de/models/demo-round/");
  await expect(page.getByRole("navigation", { name: "Sprache auswählen" }).getByRole("link", { name: "English" })).toHaveAttribute("href", /\/en\/models\/demo-round\/$/);
  const breadcrumb = await page.locator('script[type="application/ld+json"]').textContent();
  expect(JSON.parse(breadcrumb ?? "").itemListElement.at(-1).name).toBe("Demo Rundschrift");
});

test("English model and repertoire routes render honest empty-data states", async ({ page }) => {
  await page.goto("en/models/demo-round/");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("heading", { name: "Demo Round Script", level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: "View repertoire" })).toBeVisible();
  await page.goto("en/models/demo-round/letters/");
  await expect(page.getByRole("heading", { name: "Character repertoire: Demo Round Script", level: 1 })).toBeVisible();
  await expect(page.getByText("There are no glyph records for this model yet.")).toBeVisible();
});

test("letter comparison reports missing data without substituting system-font shapes", async ({ page }) => {
  await page.goto("de/compare/letters/");
  await expect(page.getByRole("heading", { name: "Buchstaben vergleichen", level: 1 })).toBeVisible();
  await expect(page.locator("#comparison-status")).toContainText("Es sind noch keine Glyphendatensätze vorhanden");
  await expect(page.getByRole("combobox", { name: "Zeichen" })).toBeDisabled();
  await expect(page.locator("#comparison-stage svg")).toHaveCount(0);
});

test.describe("fixture-backed letter comparison", () => {
  test.use({ serviceWorkers: "block" });

test("letter comparison normalizes vector outlines and shares filter and overlay state", async ({ page }) => {
  const base = (process.env.SITE_BASE_PATH ?? "").replace(/\/$/, "");
  const glyphs = [
    { model: "demo-round", character: "a", unicode: ["U+0061"], slug: "u0061", verification: "draft", url: `${base}/data/v1/glyphs/demo-round/u0061.json` },
    { model: "demo-classic", character: "a", unicode: ["U+0061"], slug: "u0061", verification: "draft", url: `${base}/data/v1/glyphs/demo-classic/u0061.json` },
  ];
  const record = (model: string, outline: object) => ({ model, character: "a", outline, metrics: { baseline: null, x_height: null, ascender: null, descender: null }, verification: "draft", license: "CC-BY-SA-4.0", sources: [] });
  await page.route("**/data/v1/index.json", (route) => route.fulfill({ json: { glyphs: `${base}/data/v1/glyphs.json`, sources: `${base}/data/v1/sources.json` } }));
  await page.route("**/data/v1/glyphs.json", (route) => route.fulfill({ json: glyphs }));
  await page.route("**/data/v1/sources.json", (route) => route.fulfill({ json: [] }));
  await page.route("**/data/v1/glyphs/demo-round/u0061.json", (route) => route.fulfill({ json: record("demo-round", { path: "M 0 80 L 100 40 Z", view_box: [0, 0, 100, 100], baseline: 80, x_height: 40 }) }));
  await page.route("**/data/v1/glyphs/demo-classic/u0061.json", (route) => route.fulfill({ json: record("demo-classic", { path: "M 0 70 L 80 30 Z", view_box: [0, 0, 80, 90], baseline: 70, x_height: 30 }) }));

  await page.goto("de/compare/letters/?character=u0061&modelA=demo-round&modelB=demo-classic&mode=overlay&opacity=0.4");
  await expect(page.locator("#comparison-stage path")).toHaveCount(2);
  await expect(page.locator('#comparison-stage line[data-guide="baseline"]')).toHaveCount(1);
  await expect(page.locator('#comparison-stage line[data-guide="x-height"]')).toHaveCount(1);
  await expect(page.locator("#comparison-stage path").nth(1)).toHaveAttribute("fill-opacity", "0.4");
  await expect(page.getByText(/Vergleich von a:/)).toBeVisible();

  await page.getByRole("combobox", { name: "Ansicht" }).selectOption("side-by-side");
  await expect(page.locator("#comparison-stage figure")).toHaveCount(2);
  const viewBoxes = await page.locator("#comparison-stage svg").evaluateAll((svgs) => svgs.map((svg) => svg.getAttribute("viewBox")));
  expect(viewBoxes[0]).toBe(viewBoxes[1]);
  await page.getByRole("combobox", { name: "Land filtern" }).selectOption("DE");
  await expect(page).toHaveURL(/country=DE/);
  await expect(page.getByRole("combobox", { name: "Modell A" })).toBeDisabled();
});
});


test("word comparison treats hostile Unicode input as literal text and requires a local calibrated font", async ({ page }) => {
  await page.goto("de/compare/words/");
  const hostileText = '<img src=x onerror="alert(1)"> & ß';
  await page.getByRole("textbox", { name: "Vergleichstext" }).fill(hostileText);
  await expect(page.locator("#word-literal-preview")).toHaveText(hostileText);
  await expect(page.locator("#word-literal-preview img")).toHaveCount(0);
  await expect(page.locator("#word-stage svg")).toHaveCount(0);
  await expect(page.locator("#word-status")).toContainText("keine lokale Referenzschrift");
});

test("practice worksheets encode settings locally and export deterministic safe SVG", async ({ page }) => {
  const requestedUrls: string[] = [];
  page.on("request", (request) => requestedUrls.push(request.url()));
  await page.goto("de/practice/");
  const exercise = "<script>x</script> ß";
  await page.getByRole("textbox", { name: "Übungstext" }).fill(exercise);
  await page.getByLabel("Papierformat").selectOption("Letter");
  await page.getByLabel("Rand (mm)").selectOption("16");
  await page.getByLabel("Schreibhilfslinien").selectOption("baseline");
  await page.getByLabel("Belegte Referenzzeile einfügen").uncheck();
  await page.getByLabel("Nachspurzeilen je Wiederholung").selectOption("1");
  await page.getByLabel("Leere Zeilen je Wiederholung").selectOption("1");
  await page.getByLabel("Wiederholungen").selectOption("2");

  const worksheet = page.locator("[data-worksheet-output] svg");
  await expect(worksheet).toHaveAttribute("width", "215.9mm");
  await expect(worksheet).toHaveAttribute("height", "279.4mm");
  await expect(worksheet.locator('[data-guide="baseline"]')).toHaveCount(4);
  await expect(worksheet.locator('[data-guide="x-height"]')).toHaveCount(0);
  await expect(worksheet.locator("path")).toHaveCount(0);
  await expect(worksheet.locator("script")).toHaveCount(0);
  await expect(worksheet.locator("text[direction]")).toHaveText(`Aufgabentext: ${exercise}`);
  expect(new URL(page.url()).search).toBe("");
  expect(new URL(page.url()).hash).toMatch(/^#worksheet=/);
  expect(requestedUrls.every((url) => !url.includes("worksheet="))).toBe(true);
  const metadata = await worksheet.locator("metadata").evaluate((element) => JSON.parse(element.textContent ?? "{}"));
  expect(metadata.settings.text).toBe(exercise);
  expect(metadata.worksheetId).toMatch(/^SAW1-[A-F0-9]{8}$/);
  expect(metadata.worksheetMarker.format).toBe("schreibatlas-fiducial");
  expect(metadata.worksheetMarker.positionsMm).toHaveLength(4);
  await expect(worksheet.locator("[data-worksheet-marker]")).toHaveCount(4);
  expect(metadata.settings.paper).toBe("Letter");

  await page.evaluate(() => {
    (window as typeof window & { worksheetPrintCalled?: boolean }).print = () => {
      (window as typeof window & { worksheetPrintCalled?: boolean }).worksheetPrintCalled = true;
    };
  });
  await page.getByRole("button", { name: "Drucken" }).click();
  expect(await page.evaluate(() => (window as typeof window & { worksheetPrintCalled?: boolean }).worksheetPrintCalled)).toBe(true);

  const firstDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "SVG herunterladen" }).click();
  const firstPath = await (await firstDownload).path();
  expect(firstPath).not.toBeNull();
  const firstSvg = readFileSync(firstPath!, "utf8");
  expect(firstSvg).toContain("&lt;script&gt;");
  expect(firstSvg).not.toMatch(/<script[ >]/i);

  await page.reload();
  await expect(page.getByRole("textbox", { name: "Übungstext" })).toHaveValue(exercise);
  await expect(page.locator("[data-worksheet-output] svg")).toHaveAttribute("width", "215.9mm");
  const secondDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "SVG herunterladen" }).click();
  const secondPath = await (await secondDownload).path();
  expect(secondPath).not.toBeNull();
  expect(readFileSync(secondPath!, "utf8")).toBe(firstSvg);
});

test("direct writing records local pointer samples with optional pressure and explicit exports", async ({ page }) => {
  const requestedUrls: string[] = [];
  page.on("request", (request) => requestedUrls.push(request.url()));
  await page.goto("de/write/");
  const surface = page.getByRole("application", { name: "Zeichenfläche" });
  await page.getByLabel("Referenzzeichen").fill("a");
  await page.getByLabel("Belegte isolierte Endform einblenden").check();
  await expect(page.getByRole("status")).toContainText("Keine belegte Vektor-Endform");
  await expect(surface.locator("[data-reference-character]")).toHaveCount(0);
  await expect(surface).toBeVisible();
  await surface.scrollIntoViewIfNeeded();
  const bounds = await surface.boundingBox();
  if (!bounds) throw new Error("Writing surface has no visible bounds.");
  const startX = bounds.x + bounds.width * 0.35;
  const startY = bounds.y + bounds.height * 0.55;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 90, startY - 45, { steps: 5 });
  await page.mouse.up();

  await expect(page.locator('[data-metric="strokeCount"]')).toHaveText("1");
  expect(Number(await page.locator('[data-metric="sampleCount"]').getAttribute("data-value"))).toBeGreaterThan(2);
  expect(Number(await page.locator('[data-metric="pathLength"]').getAttribute("data-value"))).toBeGreaterThan(0);
  await expect(page.getByRole("button", { name: "Messdaten als JSON exportieren" })).toBeEnabled();

  const jsonDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Messdaten als JSON exportieren" }).click();
  const jsonPath = await (await jsonDownload).path();
  expect(jsonPath).not.toBeNull();
  const capture = JSON.parse(readFileSync(jsonPath!, "utf8"));
  expect(capture.schemaVersion).toBe(1);
  expect(capture.samples.at(-1).penDown).toBe(false);
  expect(capture.samples.some((sample: { pointerType: string }) => sample.pointerType === "mouse")).toBe(true);
  expect(capture.metrics.pressureSampleCount).toBe(0);
  expect(capture.samples.some((sample: { pressure?: number }) => sample.pressure !== undefined)).toBe(false);

  const svgDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Zeichnung als SVG exportieren" }).click();
  const svgPath = await (await svgDownload).path();
  expect(svgPath).not.toBeNull();
  expect(readFileSync(svgPath!, "utf8")).toContain("<metadata>");

  const localOrigin = new URL(page.url()).origin;
  expect(requestedUrls.every((url) => new URL(url).origin === localOrigin)).toBe(true);
  await page.getByRole("button", { name: "Zeichnung löschen" }).click();
  await expect(page.locator('[data-metric="strokeCount"]')).toHaveText("0");
  await expect(page.getByRole("button", { name: "Messdaten als JSON exportieren" })).toBeDisabled();
  await page.getByRole("button", { name: "Zurücksetzen" }).click();
  await expect(page.getByLabel("Referenzzeichen")).toHaveValue("");
  await surface.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.down("Space");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.up("Space");
  await expect(page.locator('[data-metric="strokeCount"]')).toHaveText("1");
});

test("photo analysis keeps the image local, supports corner correction, and releases preview resources", async ({ page }) => {
  const requestMethods: string[] = [];
  const requestedUrls: string[] = [];
  page.on("request", (request) => {
    requestedUrls.push(request.url());
    requestMethods.push(request.method());
  });
  await page.goto("de/analyze/");
  await expect(page.locator("[data-offline-status]")).toContainText("Offline bereit");
  await page.evaluate(() => {
    const tracker = window as typeof window & { analysisCreated?: string[]; analysisRevoked?: string[] };
    tracker.analysisCreated = [];
    tracker.analysisRevoked = [];
    const create = URL.createObjectURL.bind(URL);
    const revoke = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = (value) => {
      const url = create(value);
      tracker.analysisCreated?.push(url);
      return url;
    };
    URL.revokeObjectURL = (url) => {
      tracker.analysisRevoked?.push(url);
      revoke(url);
    };
  });
  const pngBytes = await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 180;
    canvas.height = 100;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "white";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#111";
    context.fillRect(20, 20, 120, 9);
    context.fillRect(20, 60, 120, 9);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((value) => value ? resolve(value) : reject(new Error("Could not create a local test image.")), "image/png");
    });
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  });
  await page.getByLabel("Lokales Foto auswählen").setInputFiles({ name: "local-sample.png", mimeType: "image/png", buffer: Buffer.from(pngBytes) });
  await expect(page.locator("[data-analysis-image-frame]")).toBeVisible();
  await page.getByLabel("Erwarteter Text").fill("local sample");
  const worksheetReference = {
    schemaVersion: 1,
    kind: "schreibatlas-worksheet",
    worksheetId: "SAW1-0123ABCD",
    worksheetMarker: {
      format: "schreibatlas-fiducial",
      version: 1,
      sizeMm: 8,
      insetMm: 3,
      moduleCount: 2,
      pageWidthMm: 210,
      pageHeightMm: 297,
      positionsMm: [
        { code: 1, corner: "top-left", x: 7, y: 7 },
        { code: 2, corner: "top-right", x: 203, y: 7 },
        { code: 3, corner: "bottom-right", x: 203, y: 290 },
        { code: 4, corner: "bottom-left", x: 7, y: 290 },
      ],
    },
    writingRegionMm: { left: 22, right: 198, blankRows: [{ id: "1.1", top: 50, baseline: 63, xHeight: 58, height: 18 }] },
    settings: { text: "oo", guides: "none" },
  };
  const worksheetSvg = `<svg xmlns="http://www.w3.org/2000/svg"><metadata>${JSON.stringify(worksheetReference)}</metadata></svg>`;
  await page.getByLabel("Passendes Schreibatlas-Arbeitsblatt (SVG, optional)").setInputFiles({ name: "worksheet.svg", mimeType: "image/svg+xml", buffer: Buffer.from(worksheetSvg) });
  await expect(page.locator("[data-analysis-worksheet-reference-status]")).toContainText(worksheetReference.worksheetId);
  const topLeft = page.locator('[data-analysis-corner="0"]');
  await topLeft.focus();
  await page.keyboard.press("ArrowRight");
  await expect(topLeft).toHaveAttribute("cx", "4");
  const previewUrl = await page.locator("[data-analysis-preview]").getAttribute("src");
  expect(previewUrl).toMatch(/^blob:/);

  await page.getByRole("button", { name: "Lokal analysieren" }).click();
  await expect(page.locator("[data-analysis-results]")).toBeVisible();
  await expect(page.locator("[data-analysis-line-count]")).toHaveText("2");
  await expect(page.locator("[data-analysis-rectified]")).toBeVisible();
  await expect(page.locator("[data-analysis-overlay]")).toBeVisible();
  await expect(page.locator("[data-analysis-word-gaps]")).toHaveText(/Nicht verfügbar/);
  await expect(page.locator("[data-analysis-worksheet-result]")).toContainText("Arbeitsblattmarker nicht zuverlässig erkannt");
  const [jsonDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Messdaten als JSON herunterladen" }).click(),
  ]);
  expect(jsonDownload.suggestedFilename()).toBe("schreibatlas-photo-analysis.json");
  const jsonPath = await jsonDownload.path();
  const report = JSON.parse(readFileSync(jsonPath!, "utf8"));
  expect(report.context.expectedText).toBe("local sample");
  expect(report.metrics.lines).toHaveLength(2);
  expect(report.metrics.worksheetGeometry.status).toBe("unavailable");
  expect(report.metrics.worksheetWriting).toBeNull();
  expect(report.metrics.lines[0].baselineCandidate.confidence).toBe("low");
  expect(report.unavailable.wordGaps.available).toBe(false);
  expect(report).not.toHaveProperty("score");
  expect(report.metrics).not.toHaveProperty("preview");
  expect(report.metrics).not.toHaveProperty("mask");
  const [overlayDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Analyse-Overlay als PNG herunterladen" }).click(),
  ]);
  expect(overlayDownload.suggestedFilename()).toBe("schreibatlas-photo-analysis-overlay.png");
  expect(await page.evaluate(() => localStorage.length)).toBe(0);
  expect(await page.evaluate(() => sessionStorage.length)).toBe(0);
  const localOrigin = new URL(page.url()).origin;
  expect(requestedUrls.every((url) => new URL(url).origin === localOrigin)).toBe(true);
  expect(requestMethods.every((method) => method === "GET")).toBe(true);
  const cachedResources = await page.evaluate(async () => {
    const cacheNames = await caches.keys();
    const urls = await Promise.all(cacheNames.map(async (name) => (await caches.open(name)).keys()));
    return { cacheNames, urls: urls.flat().map((request) => request.url) };
  });
  expect(cachedResources.cacheNames).toContain("schreibatlas-static-v1");
  expect(cachedResources.urls.some((url) => url.includes("/de/analyze/"))).toBe(true);
  expect(cachedResources.urls.some((url) => url.includes("photo-analysis.worker"))).toBe(true);
  expect(cachedResources.urls.every((url) => !url.startsWith("blob:") && !url.includes("local sample"))).toBe(true);

  await page.getByRole("button", { name: "Bild und Ergebnisse löschen" }).click();
  await expect(page.locator("[data-analysis-image-frame]")).toBeHidden();
  expect(await page.evaluate((url) => (window as typeof window & { analysisRevoked?: string[] }).analysisRevoked?.includes(url ?? ""), previewUrl)).toBe(true);
  await expect(page.getByLabel("Erwarteter Text")).toHaveValue("");
  await page.context().setOffline(true);
  await expect(page.getByLabel("Passendes Schreibatlas-Arbeitsblatt (SVG, optional)")).toHaveValue("");
  try {
    await page.goto("de/analyze/");
    await expect(page.getByRole("heading", { name: "Handschriftfoto lokal untersuchen" })).toBeVisible();
    await expect(page.getByLabel("Lokales Foto auswählen")).toBeVisible();
    await page.getByLabel("Lokales Foto auswählen").setInputFiles({ name: "offline-sample.png", mimeType: "image/png", buffer: Buffer.from(pngBytes) });
    await page.getByLabel("Erwarteter Text").fill("offline sample");
    await page.getByRole("button", { name: "Lokal analysieren" }).click();
    await expect(page.locator("[data-analysis-line-count]")).toHaveText("2");
  } finally {
    await page.context().setOffline(false);
  }
});

test("stroke diagrams and one-shot animation share paths and honor reduced motion", async ({ page }) => {
  await page.setContent(`
    <style>.stroke-animation{display:none}.stroke-animation[data-visible="true"]{display:block}</style>
    <div data-stroke-renderer data-initial="Animation starts on request." data-reduced="Animation disabled for reduced motion." data-complete="Animation complete." data-error="Animation unavailable.">
      <ol><li data-stroke-step data-duration-ms="20"><svg viewBox="0 0 1 1"><path d="M 0 0 L 0.5 1"></path></svg></li></ol>
      <button data-stroke-play hidden>Play once</button>
      <svg class="stroke-animation" data-stroke-animation data-visible="false" viewBox="0 0 1 1"></svg>
      <p data-stroke-status role="status" aria-live="polite">Animation starts on request.</p>
    </div>
  `);
  await page.addScriptTag({ content: strokeRendererScript });

  const button = page.getByRole("button", { name: "Play once" });
  const stage = page.locator("[data-stroke-animation]");
  await expect(button).toBeVisible();
  await expect(stage).toBeHidden();
  await button.click();
  await expect(page.getByRole("status")).toHaveText("Animation complete.");
  await expect(stage).toBeVisible();
  expect(await stage.locator("path").getAttribute("d")).toBe("M 0 0 L 0.5 1");
  await page.waitForTimeout(100);
  await expect(page.getByRole("status")).toHaveText("Animation complete.");

  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(button).toBeHidden();
  await expect(page.getByRole("status")).toHaveText("Animation disabled for reduced motion.");
  await expect(page.locator("ol path")).toBeVisible();
  await expect(stage).toBeHidden();
});

test("localized home remains readable at a narrow viewport", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("de/");
  await expect(page.getByRole("heading", { name: "Handschriftmodelle offen erkunden", level: 1 })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});


test("comparison remains usable at a narrow zoom-equivalent viewport", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.setViewportSize({ width: 320, height: 812 });
  await page.goto("de/compare/letters/");
  await expect(page.getByRole("heading", { name: "Buchstaben vergleichen", level: 1 })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Zeichen" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(pageErrors).toEqual([]);
});

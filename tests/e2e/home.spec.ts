// SPDX-License-Identifier: Apache-2.0
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { Buffer } from "node:buffer";
import { ModuleKind, ScriptTarget, transpileModule } from "typescript";

const strokeRendererSource = readFileSync(new URL("../../src/scripts/stroke-renderer.ts", import.meta.url), "utf8");
const { outputText: strokeRendererScript } = transpileModule(strokeRendererSource, { compilerOptions: { module: ModuleKind.ESNext, target: ScriptTarget.ES2022 } });



const createVolksschriftImage = (page: Page, lines: string[]) => page.evaluate(async (lineTexts) => {
  const index = await fetch("/data/v1/index.json").then((response) => response.json());
  const fonts = await fetch(index.fonts).then((response) => response.json());
  const font = fonts.find((record: { id: string }) => record.id === "font-volksschrift");
  if (!font?.file_urls?.[0] || !font.calibration?.x_height_em) throw new Error("Bundled Volksschrift test font is unavailable.");
  const family = "e2e-volksschrift-reference";
  const face = await new FontFace(family, `url(\"${font.file_urls[0]}\")`).load();
  document.fonts.add(face);
  const fontSize = 40 / font.calibration.x_height_em;
  const canvas = document.createElement("canvas");
  canvas.width = 1000;
  canvas.height = Math.ceil(fontSize * 1.5 * Math.max(0, lineTexts.length - 1) + fontSize * 1.2 + 24);
  const context = canvas.getContext("2d")!;
  context.fillStyle = "white";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.font = `${fontSize}px \"${family}\"`;
  context.textBaseline = "alphabetic";
  context.fillStyle = "#111";
  const ascent = context.measureText(lineTexts[0]).actualBoundingBoxAscent;
  lineTexts.forEach((line, index) => context.fillText(line, 32, 12 + ascent + index * fontSize * 1.5));
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("Could not create a reference image.")), "image/png"));
  return Array.from(new Uint8Array(await blob.arrayBuffer()));
}, lines);
test("root offers direct German and English routes", async ({ page }) => {
  await page.goto("./");
  await expect(page.getByRole("heading", { name: "Schreibatlas", level: 1 })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Language / Sprache" }).getByRole("link", { name: "Deutsch" })).toHaveAttribute("href", /\/de\/$/);
  await expect(page.getByRole("navigation", { name: "Language / Sprache" }).getByRole("link", { name: "English" })).toHaveAttribute("href", /\/en\/$/);
});

test("localized reference and analysis routes pass the automated WCAG audit", async ({ page }) => {
  for (const route of ["de/", "en/about/", "de/analyze/", "de/explore/", "de/models/de-volksschrift/letters/u0061/", "de/compare/words/", "de/write/"]) {
    await page.goto(route);
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
    expect(results.violations, `${route}: ${JSON.stringify(results.violations.map(({ id, description, nodes }) => ({ id, description, nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })) })))}`).toEqual([]);
  }
});

test("German home exposes localized metadata and accessible navigation", async ({ page }) => {
  await page.goto("de/");
  await expect(page.locator("html")).toHaveAttribute("lang", "de");
  await expect(page.getByRole("heading", { name: "Handschriftmodelle offen erkunden", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Kleines Teilkorpus, keine vollständigen Standards" })).toBeVisible();
  await expect(page.getByText("Elf Buchstabenumrisse sind erfasst.")).toBeVisible();
  await expect(page.getByText(/Fotoanalyse verarbeitet Bilder lokal/)).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://schreibatlas.de/de/");
  await expect(page.locator('link[hreflang="en"]')).toHaveAttribute("href", "https://schreibatlas.de/en/");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Zum Inhalt springen" })).toBeFocused();
});

test("English home is a direct localized route with language navigation", async ({ page }) => {
  await page.goto("en/");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("heading", { name: "Explore handwriting models openly", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Small partial corpus, not complete standards" })).toBeVisible();
  await expect(page.getByText("Eleven letter outlines are recorded.")).toBeVisible();
  await expect(page.getByText(/Photo analysis processes images locally/)).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Choose language" }).getByRole("link", { name: "Deutsch" })).toHaveAttribute("href", /\/de\/$/);
  await expect(page.locator('link[hreflang="de"]')).toHaveAttribute("href", "https://schreibatlas.de/de/");
});


test("explore filters validated model records using recorded metadata", async ({ page }) => {
  await page.goto("de/explore/");
  await expect(page.locator("html")).toHaveAttribute("lang", "de");
  await expect(page.getByRole("heading", { name: "Handschriftmodelle", level: 1 })).toBeVisible();
  await expect(page.locator("[data-model-card]")).toHaveCount(11);
  await page.getByRole("searchbox", { name: "Modelle suchen" }).fill("Rundschrift");
  await expect(page.locator("[data-model-card]:visible")).toHaveCount(2);
  await page.getByRole("searchbox", { name: "Modelle suchen" }).fill("not-a-model");
  await expect(page.getByText("Keine Modelle passen zu den aktuellen Filtern.")).toBeVisible();
  await page.getByRole("searchbox", { name: "Modelle suchen" }).fill("");
  await page.locator('[data-model-filter="joined"]').selectOption("joined");
  await expect(page.locator("[data-model-card]:visible")).toHaveCount(5);
  await expect(page.locator("[data-model-card]:visible").filter({ hasText: "Deutsche Volksschrift" })).toHaveCount(1);
  await expect(page.locator("[data-model-card]:visible").first()).toContainText("Verbundene Schrift: Vorhanden");
  await page.locator('[data-model-filter="joined"]').selectOption("");
  await page.locator('[data-model-filter="use"]').selectOption("historical");
  await expect(page.locator("[data-model-card]:visible")).toHaveCount(4);

  await page.goto("de/models/demo-round/");
  await expect(page.getByRole("heading", { name: "Demo Rundschrift", level: 1 })).toBeVisible();
  await expect(page.getByText("Projektplatzhalter, kein fachlicher Beleg")).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://schreibatlas.de/de/models/demo-round/");
  await expect(page.getByRole("navigation", { name: "Sprache auswählen" }).getByRole("link", { name: "English" })).toHaveAttribute("href", /\/en\/models\/demo-round\/$/);
  const breadcrumb = await page.locator('script[type="application/ld+json"]').textContent();
  expect(JSON.parse(breadcrumb ?? "").itemListElement.at(-1).name).toBe("Demo Rundschrift");
});


test("bilingual licensing page exposes provenance and country/language API exports", async ({ page }) => {
  await page.goto("de/about/");
  await expect(page.getByRole("heading", { name: "Lizenzen, Quellen und Daten", level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: "Lizenzen und Provenienz" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Apache License 2\.0/ })).toHaveAttribute("href", "https://www.apache.org/licenses/LICENSE-2.0");
  await expect(page.getByRole("link", { name: /CC BY-SA 4\.0/ })).toHaveAttribute("href", "https://creativecommons.org/licenses/by-sa/4.0/");
  await expect(page.getByRole("heading", { name: "Quellen und Herkunft" })).toBeVisible();
  await expect(page.getByRole("link", { name: "API-Index" })).toHaveAttribute("href", /data\/v1\/index\.json$/);
  await expect(page.getByRole("link", { name: "Länderdatensätze" })).toHaveAttribute("href", /data\/v1\/countries\.json$/);
  await expect(page.getByRole("link", { name: "Sprachdatensätze" })).toHaveAttribute("href", /data\/v1\/languages\.json$/);
  await expect(page.getByRole("link", { name: /OFL-1.1-Volksschrift\.txt/ })).toBeVisible();

  const countriesResponse = await page.request.get(new URL("/data/v1/countries.json", page.url()).href);
  const languagesResponse = await page.request.get(new URL("/data/v1/languages.json", page.url()).href);
  expect(await countriesResponse.json()).toMatchObject([{ id: "DE" }]);
  expect(await languagesResponse.json()).toMatchObject([{ id: "de" }]);

  await page.goto("en/about/");
  await expect(page.getByRole("heading", { name: "Licenses, sources, and data", level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: "Licenses and provenance" })).toBeVisible();
});


test("letter detail renders its recorded normalized outline and provenance", async ({ page }) => {
  const glyph = parse(readFileSync(new URL("../../data/glyphs/de-volksschrift/0061.yaml", import.meta.url), "utf8")) as {
    outline: { path: string; view_box: [number, number, number, number]; baseline: number; x_height: number; fill_rule?: string };
  };
  await page.goto("de/models/de-volksschrift/letters/u0061/");
  const outline = page.locator("[data-glyph-outline]");
  await expect(outline).toHaveCount(1);
  await expect(outline).toHaveAttribute("role", "img");
  await expect(outline.locator("path")).toHaveAttribute("d", glyph.outline.path);
  const scale = 1 / (glyph.outline.baseline - glyph.outline.x_height);
  const transform = `translate(${-glyph.outline.view_box[0] * scale} ${glyph.outline.baseline * scale}) scale(${scale} ${-scale})`;
  await expect(outline.locator("path")).toHaveAttribute("transform", transform);
  await expect(outline.locator('[data-guide="baseline"]')).toHaveAttribute("y1", "0");
  await expect(outline.locator('[data-guide="x-height"]')).toHaveAttribute("y1", "1");
  await expect(page.locator(".verification-badge.status-source-backed")).toHaveCount(2);
  await expect(page.getByRole("heading", { name: "Quellen und Herkunft" })).toBeVisible();
  await expect(page.getByRole("link", { name: /OFL-1.1-Volksschrift\.txt/ })).toHaveAttribute("href", /data\/v1\/assets\/fonts\/font-volksschrift\//);
});

test("repertoire renders recorded outlines and reports glyphs without vector data", async ({ page }) => {
  await page.goto("en/models/de-volksschrift/letters/");
  await expect(page.locator("[data-glyph-card]")).toHaveCount(60);
  await expect(page.locator("[data-glyph-outline] path")).toHaveCount(10);
  await expect(page.locator(".verification-badge.status-source-backed")).toHaveCount(11);

  await page.goto("en/models/de-kurrent-loth-1866/letters/");
  await expect(page.locator("[data-glyph-card]")).toHaveCount(57);
  await expect(page.locator("[data-glyph-outline]")).toHaveCount(0);
  await expect(page.locator("[data-font-preview]")).not.toHaveCount(0);
  await expect(page.locator(".glyph-card .glyph-text-label").first()).toHaveText("A");
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
  await expect(page.locator("#comparison-status")).toContainText("Für diese Glyphendaten ist keine belegte Vektorform verfügbar");
  await expect(page.getByRole("combobox", { name: "Zeichen" })).toBeEnabled();
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


test("word comparison keeps hostile Unicode literal and refuses unsupported text", async ({ page }) => {
  await page.goto("de/compare/words/");
  await page.locator("#word-model-a").selectOption("de-la");
  await page.locator("#word-model-b").selectOption("de-sas");
  const input = page.getByRole("textbox", { name: "Vergleichstext" });
  const hostileText = '<img src=x onerror="alert(1)"> & ß ﬁ a\u0308';
  await input.fill(hostileText);
  await expect(page.locator("#word-literal-preview")).toHaveText(hostileText);
  await expect(page.locator("#word-literal-preview img")).toHaveCount(0);
  await expect(page.locator("#word-status")).toContainText("nicht von beiden Referenzschriften abgedeckt");
  await expect(page.locator("#word-stage text")).toHaveCount(0);
  await input.fill("Schule");
  await expect(page.locator("#word-stage text")).toHaveText(["Schule", "Schule"]);
  await expect(page.locator(".comparison-provenance-card")).toHaveCount(2);
  await expect(page.locator("#word-provenance")).toContainText("CTAN schulschriften 5");
  await expect(page.locator("#word-provenance")).toContainText("Version 1.0");
});

test("word shaping preserves connected words and refuses unsupported combining sequences and ligature characters", async ({ page }) => {
  await page.goto("de/compare/words/");
  await page.locator("#word-model-a").selectOption("de-la");
  await page.locator("#word-model-b").selectOption("de-sas");
  const input = page.getByRole("textbox", { name: "Vergleichstext" });
  for (const fixture of ["office", "Schifffahrt", "ä"]) {
    await input.fill(fixture);
    await expect(page.locator("#word-stage text")).toHaveText([fixture, fixture]);
  }
  for (const unsupported of ["a\u0308", "ﬁ"]) {
    await input.fill(unsupported);
    await expect(page.locator("#word-status")).toContainText("nicht von beiden Referenzschriften abgedeckt");
    await expect(page.locator("#word-stage text")).toHaveCount(0);
  }
});

test("sentence comparison retains line breaks with explicitly non-empirical spacing", async ({ page }) => {
  await page.goto("de/compare/sentences/");
  await expect(page.getByRole("heading", { name: "Sätze vergleichen", level: 1 })).toBeVisible();
  await page.locator("#word-model-a").selectOption("de-la");
  await page.locator("#word-model-b").selectOption("de-sas");
  await page.getByRole("button", { name: "Beispielsatz auf Deutsch einfügen" }).click();
  const input = page.getByRole("textbox", { name: "Satztext" });
  const firstLine = "Fleißige Schüler üben täglich.";
  await expect(input).toHaveValue(firstLine);
  await input.fill(`${firstLine}\nSchreibatlas vergleicht Schriften.`);
  await expect(page.locator('#word-stage text[data-text-line="1"]')).toHaveCount(2);
  await expect(page.locator('#word-stage text[data-text-line="1"]').first()).toHaveAttribute("y", "-1.5");
  await expect(page.locator(".page-heading")).toContainText("festen Abstand von 1,5 x-Höhen");
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

test("source-backed worksheet presets export repeatable PNG and traceable PDF metadata", async ({ page }) => {
  await page.goto("de/practice/");
  await page.getByLabel("Übungsvorlage").selectOption("volksschrift-blume");
  await expect(page.getByRole("textbox", { name: "Übungstext" })).toHaveValue("blume");
  await expect(page.getByLabel("Handschriftmodell")).toHaveValue("de-volksschrift");

  const worksheet = page.locator("[data-worksheet-output] svg");
  await expect(worksheet.locator('[data-character="b"]')).toHaveCount(3);
  await expect(worksheet.locator("[data-worksheet-marker]")).toHaveCount(4);
  const metadata = await worksheet.locator("metadata").evaluate((element) => JSON.parse(element.textContent ?? "{}"));
  expect(metadata.settings.text).toBe("blume");
  expect(metadata.model.id).toBe("de-volksschrift");
  expect(metadata.datasetVersion).toBeTruthy();
  expect(metadata.worksheetId).toMatch(/^SAW1-[A-F0-9]{8}$/);
  expect(metadata.outlines.flatMap((outline: { sources: string[] }) => outline.sources)).toContain("src-volksschrift-font");
  expect(metadata.outlines.every((outline: { sources: string[] }) => outline.sources.length > 0)).toBe(true);

  const firstPngDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "PNG herunterladen" }).click();
  const firstPngPath = await (await firstPngDownload).path();
  expect(firstPngPath).not.toBeNull();
  const firstPng = readFileSync(firstPngPath!);
  expect(firstPng.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  expect(firstPng.readUInt32BE(16)).toBe(1984);
  expect(firstPng.readUInt32BE(20)).toBe(2806);
  const textIndex = firstPng.indexOf(Buffer.from("tEXt"));
  expect(textIndex).toBeGreaterThan(8);
  const textLength = firstPng.readUInt32BE(textIndex - 4);
  const textData = firstPng.subarray(textIndex + 4, textIndex + 4 + textLength).toString("utf8");
  const [keyword, encodedPngMetadata] = textData.split("\0");
  expect(keyword).toBe("SchreibatlasWorksheet");
  expect(JSON.parse(Buffer.from(encodedPngMetadata, "base64").toString("utf8"))).toEqual(metadata);

  const secondPngDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "PNG herunterladen" }).click();
  const secondPngPath = await (await secondPngDownload).path();
  expect(secondPngPath).not.toBeNull();
  expect(readFileSync(secondPngPath!)).toEqual(firstPng);

  const pdfDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "PDF herunterladen" }).click();
  const pdfPath = await (await pdfDownload).path();
  expect(pdfPath).not.toBeNull();
  const pdf = readFileSync(pdfPath!).toString("latin1");
  expect(pdf.startsWith("%PDF-1.7")).toBe(true);
  expect(pdf).toContain(`/Subject (${metadata.worksheetId})`);
  const encodedPdfMetadata = pdf.match(/<sa:metadata encoding="base64">([^<]+)<\/sa:metadata>/)?.[1];
  expect(encodedPdfMetadata).toBeTruthy();
  expect(JSON.parse(Buffer.from(encodedPdfMetadata!, "base64").toString("utf8"))).toEqual(metadata);
});

test("direct writing records local pointer samples with optional pressure and explicit exports", async ({ page }) => {
  const requestedUrls: string[] = [];
  page.on("request", (request) => requestedUrls.push(request.url()));
  await page.goto("de/write/");
  const surface = page.getByRole("application", { name: "Zeichenfläche" });
  await page.getByLabel("Referenzzeichen").fill("a");
  await page.getByLabel("Belegte isolierte Endform einblenden").check();
  await expect(page.locator("[data-writing-status]")).toContainText("Keine belegte Vektor-Endform");
  await expect(surface.locator("[data-reference-character]")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Bewegung vergleichen" })).toBeDisabled();
  await expect(page.locator("[data-movement-status]")).toContainText("keine geprüfte, quellenbelegte Strichfolge");
  await expect(page.locator("[data-movement-results]")).toBeHidden();
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
  await expect(page.getByRole("button", { name: "Bewegung vergleichen" })).toBeDisabled();
  await expect(page.locator("[data-movement-results]")).toBeHidden();

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


test.describe("verified movement comparison fixtures", () => {
  test.use({ serviceWorkers: "block" });
  test("direct writing compares only against locally loaded verified stroke references", async ({ page }) => {
  const source = {
    id: "src-synthetic-e2e",
    kind: "test-fixture",
    title: "Synthetic test fixture (not historical evidence)",
    author: ["Playwright"],
    publisher: null,
    year: null,
    locator: null,
    url: null,
    rights: { type: "test-fixture", license: "CC0-1.0" },
    notes: "Synthetic test data only.",
  };
  const strokeRecord = {
    model: "de-volksschrift",
    character: "a",
    verification: "verified",
    sources: [source.id],
    license: "CC0-1.0",
    strokes: [
      { order: 1, file: "assets/strokes/test/horizontal.svg", file_url: "/data/v1/strokes/horizontal.svg", pen_down: true, start: [0.1, 0.4], end: [0.5, 0.4], timing_ms: null },
      { order: 2, file: "assets/strokes/test/vertical.svg", file_url: "/data/v1/strokes/vertical.svg", pen_down: true, start: [0.5, 0.4], end: [0.5, 0.8], timing_ms: null },
    ],
  };
  await page.route(/\/data\/v1\/strokes\.json$/, (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify([{ model: strokeRecord.model, character: strokeRecord.character, verification: strokeRecord.verification, url: "/data/v1/strokes/fixture.json" }]),
  }));
  await page.route(/\/data\/v1\/strokes\/fixture\.json$/, (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify(strokeRecord) }));
  await page.route(/\/data\/v1\/sources\.json$/, (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify([source]) }));
  await page.route(/\/data\/v1\/strokes\/horizontal\.svg$/, (route) => route.fulfill({
    contentType: "image/svg+xml",
    body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><path d="M0.1 0.4 L0.5 0.4"/></svg>',
  }));
  await page.route(/\/data\/v1\/strokes\/vertical\.svg$/, (route) => route.fulfill({
    contentType: "image/svg+xml",
    body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><path d="M0.5 0.4 L0.5 0.8"/></svg>',
  }));

  await page.goto("de/write/");
  await page.locator("[data-writing-model]").selectOption(strokeRecord.model);
  await page.getByLabel("Referenzzeichen").fill(strokeRecord.character);
  await expect(page.locator("[data-movement-status]")).toContainText("Erfasse eine Schreibprobe, um den Vergleich zu aktivieren");
  await expect(page.locator("[data-movement-sources]")).toContainText(source.title);
  const surface = page.getByRole("application", { name: "Zeichenfläche" });
  await surface.scrollIntoViewIfNeeded();
  const bounds = await surface.boundingBox();
  if (!bounds) throw new Error("Writing surface has no visible bounds.");
  const draw = async (points: [number, number][]) => {
    await page.mouse.move(bounds.x + points[0][0] * bounds.width, bounds.y + points[0][1] * bounds.height);
    await page.mouse.down();
    for (const [x, y] of points.slice(1)) await page.mouse.move(bounds.x + x * bounds.width, bounds.y + y * bounds.height, { steps: 5 });
    await page.mouse.up();
  };
  await draw([[0.06, 0.4], [0.3, 0.4]]);
  await draw([[0.3, 0.4], [0.3, 0.8]]);
  const compareButton = page.getByRole("button", { name: "Bewegung vergleichen" });
  await expect(compareButton).toBeEnabled();
  await compareButton.click();
  await expect(page.locator("[data-movement-status]")).toHaveText("Bewegungsvergleich abgeschlossen.");
  await expect(page.locator('[data-movement-result="start"]')).toContainText("innerhalb der Beobachtungstoleranz");
  await expect(page.locator('[data-movement-result="direction"]')).toContainText("innerhalb der Beobachtungstoleranz");
  await expect(page.locator('[data-movement-result="order"]')).toContainText("innerhalb der Beobachtungstoleranz");
  await expect(page.locator('[data-movement-result="penLifts"]')).toContainText("innerhalb der Beobachtungstoleranz");
  await expect(page.locator('[data-movement-result="rhythm"]')).toContainText("nicht verfügbar");
  await expect(page.locator("[data-movement-result-note]")).toContainText("Dies ist kein Gesamtwert");
});
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
  const offlineManifest = await page.evaluate(async () => fetch("/offline-precache.json").then((response) => response.json()));
  expect(offlineManifest.cacheName).toMatch(/^schreibatlas-static-[a-f0-9]{16}$/);
  expect(offlineManifest.urls).toContain("/de/analyze/");
  expect(offlineManifest.urls.some((url: string) => /uploads|reports|user-content/.test(url))).toBe(false);
  expect(offlineManifest.urls.some((url: string) => /^(?:blob|data):/.test(url))).toBe(false);
  const cachedResources = await page.evaluate(async () => {
    const cacheNames = await caches.keys();
    const urls = await Promise.all(cacheNames.map(async (name) => (await caches.open(name)).keys()));
    return { cacheNames, urls: urls.flat().map((request) => request.url) };
  });
  expect(cachedResources.cacheNames.some((name) => name.startsWith("schreibatlas-static-"))).toBe(true);
  expect(cachedResources.urls.some((url) => url.includes("/de/analyze/"))).toBe(true);
  expect(cachedResources.urls.some((url) => url.includes("photo-analysis.worker"))).toBe(true);
  expect(cachedResources.urls.some((url) => url.includes("offline-precache.json"))).toBe(true);
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
test("photo reference comparison uses local font evidence and gates measurements by confidence", async ({ page }) => {
  const requestedUrls: string[] = [];
  const requestMethods: string[] = [];
  page.on("request", (request) => {
    requestedUrls.push(request.url());
    requestMethods.push(request.method());
  });
  await page.goto("de/analyze/");
  await expect(page.locator("[data-offline-status]")).toContainText("Offline bereit");
  const twoLineImage = await createVolksschriftImage(page, ["blume sonne", "lesen limo"]);
  await page.locator("[data-analysis-model]").selectOption("de-volksschrift");
  await page.getByLabel("Erwarteter Text").fill("blume sonne\nlesen limo");
  await page.getByLabel("Lokales Foto auswählen").setInputFiles({ name: "volksschrift-reference.png", mimeType: "image/png", buffer: Buffer.from(twoLineImage) });
  await page.getByRole("button", { name: "Lokal analysieren" }).click();
  await expect(page.locator("[data-analysis-reference-status]")).toContainText("Mittlere Konfidenz");
  await expect(page.locator("[data-analysis-reference-figure]")).toBeVisible();
  await expect(page.locator("[data-analysis-reference-metrics]")).toBeVisible();
  await expect(page.locator("[data-analysis-reference-font]")).toContainText("Volksschrift");
  await expect(page.locator("[data-analysis-reference-font] a")).toHaveText("OFL-1.1");
  await expect(page.locator("[data-analysis-reference-sources]")).toBeVisible();
  await expect(page.locator("[data-analysis-reference-view]")).toBeEnabled();
  await page.locator("[data-analysis-reference-view]").selectOption("reference");
  await expect(page.locator("[data-analysis-reference-canvas]")).toHaveAttribute("aria-label", "Referenz");
  await page.locator("[data-analysis-reference-view]").selectOption("overlay");
  await expect(page.locator("[data-analysis-reference-canvas]")).toHaveAttribute("aria-label", "Überlagerung");
  await page.locator("[data-analysis-reference-view]").selectOption("difference");
  await expect(page.locator("[data-analysis-reference-canvas]")).toHaveAttribute("aria-label", "Differenz");

  const [jsonDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Messdaten als JSON herunterladen" }).click(),
  ]);
  const report = JSON.parse(readFileSync((await jsonDownload.path())!, "utf8"));
  expect(report.context.referenceFontId).toBe("font-volksschrift");
  expect(report.context.referenceUsedForAlignment).toBe(true);
  expect(report.referenceComparison.fit.confidence).toBe("medium");
  expect(report.referenceComparison.font.correspondence.degree).toBe("partial");
  expect(report.referenceComparison.font.licenseFileUrl).toContain("/data/v1/");
  expect(report.referenceComparison.font.sources).toHaveLength(2);
  expect(report.referenceComparison.font.fileUrls[0]).toContain("/data/v1/");
  expect(report.referenceComparison.font.sources[0]).toHaveProperty("id");
  expect(report.unavailable.wordGaps.referenceUsed).toBe(true);
  expect(report.referenceComparison.wordSpacing.available).toBe(true);
  expect(report).not.toHaveProperty("score");

  await page.getByLabel("Erwarteter Text").fill("blume sonne");
  await page.getByRole("button", { name: "Lokal analysieren" }).click();
  await expect(page.locator("[data-analysis-reference-status]")).toContainText("Keine Referenzanpassung");
  await expect(page.locator("[data-analysis-reference-figure]")).toBeHidden();

  await page.getByLabel("Erwarteter Text").fill("blume sonne\nlesen limo");
  await page.locator("[data-analysis-model]").selectOption("de-kurrent-loth-1866");
  await page.getByRole("button", { name: "Lokal analysieren" }).click();
  await expect(page.locator("[data-analysis-reference-font]")).toContainText("Langula Kurrent");
  const localOrigin = new URL(page.url()).origin;
  expect(requestedUrls.every((url) => new URL(url).origin === localOrigin)).toBe(true);
  expect(requestMethods.every((method) => method === "GET")).toBe(true);
});

test("photo reference comparison withholds measurements for a single-line low-confidence fit", async ({ page }) => {
  await page.goto("de/analyze/");
  await expect(page.locator("[data-offline-status]")).toContainText("Offline bereit");
  const oneLineImage = await createVolksschriftImage(page, ["blume sonne"]);
  await page.locator("[data-analysis-model]").selectOption("de-volksschrift");
  await page.getByLabel("Erwarteter Text").fill("blume sonne");
  await page.getByLabel("Lokales Foto auswählen").setInputFiles({ name: "single-line-reference.png", mimeType: "image/png", buffer: Buffer.from(oneLineImage) });
  await page.getByRole("button", { name: "Lokal analysieren" }).click();
  await expect(page.locator("[data-analysis-reference-status]")).toContainText("niedrige Konfidenz");
  await expect(page.locator("[data-analysis-reference-figure]")).toBeVisible();
  await expect(page.locator("[data-analysis-reference-metrics]")).toBeHidden();
  await expect(page.locator("[data-analysis-reference-word-spacing]")).toContainText("Nicht verfügbar");
  const [jsonDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Messdaten als JSON herunterladen" }).click(),
  ]);
  const report = JSON.parse(readFileSync((await jsonDownload.path())!, "utf8"));
  expect(report.referenceComparison.fit.confidence).toBe("low");
  expect(report.referenceComparison.wordSpacing.available).toBe(false);
  expect(report.unavailable.wordGaps.available).toBe(false);
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

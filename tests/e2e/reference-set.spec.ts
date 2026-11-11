// SPDX-License-Identifier: Apache-2.0
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync } from "node:fs";

const ctanModels = ["de-la", "de-sas", "de-va", "de-suetterlin", "de-deutsche-normalschrift"];
const modelPairs = [["de-la", "de-sas"], ["de-va", "de-suetterlin"], ["de-deutsche-normalschrift", "de-la"]];
const fontIds = new Map([
  ["de-la", "font-schulschriften-la"],
  ["de-sas", "font-schulschriften-sas"],
  ["de-va", "font-schulschriften-va"],
  ["de-suetterlin", "font-schulschriften-suetterlin"],
  ["de-deutsche-normalschrift", "font-schulschriften-dn"],
]);
const archiveSha256 = "b33215791baec691dda5b1bac5a57cc50fadc931dc43c09759d77c0c404e72fc";

for (const lang of ["de", "en"]) {
  test(`${lang}: CTAN reference pages expose local font provenance without invented glyph evidence`, async ({ page }) => {
    for (const model of ctanModels) {
      await page.goto(`${lang}/models/${model}/letters/u0072/`);
      await expect(page.locator("[data-font-preview-shape]")).toBeVisible();
      await expect(page.locator("[data-glyph-outline]")).toHaveCount(0);
      await expect(page.locator("[data-font-preview]")).toContainText("Version 1.0");
      await expect(page.locator("[data-font-preview]")).toContainText("CTAN schulschriften 5");
      await expect(page.locator('[data-font-preview] a[href$="LPPL-1.3c-Schulschriften.txt"]')).toHaveCount(1);
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    }
  });
}

test("Grundschrift and unsupported characters stay unavailable without a substitute", async ({ page }) => {
  await page.goto("en/models/de-grundschrift/");
  await expect(page.locator("body")).toContainText("No local digital reference font is currently assigned to this model");
  await page.goto("en/compare/letters/");
  await expect(page.locator("[data-multi-stage]")).toContainText("Grundschrift · Rendering unavailable.");

  await page.goto("en/compare/words/");
  await page.locator("#word-model-a").selectOption("de-la");
  await page.locator("#word-model-b").selectOption("de-sas");
  await page.locator("#word-input").fill("😀");
  await expect(page.locator("#word-status")).toContainText("not covered by both reference fonts");
  await expect(page.locator("#word-stage text")).toHaveCount(0);
});

test("failed font loads leave an unavailable state without a system-font substitute", async ({ page }) => {
  await page.route("**/*.ttf", (route) => route.abort());
  await page.goto("en/models/de-sas/letters/u0072/");
  await expect(page.locator("[data-font-preview-shape]")).toBeHidden();
  await expect(page.locator("[data-font-preview-unavailable]")).toBeVisible();
});

test("repertoire browsing and completeness distinguish font coverage from source traces", async ({ page }) => {
  await page.goto("en/models/de-sas/letters/");
  await expect(page.locator("[data-glyph-card]")).toHaveCount(73);
  await expect(page.locator("[data-font-preview-shape]").first()).toBeVisible();
  await page.goto("en/models/de-sas/");
  await expect(page.locator("[data-model-completeness]")).toContainText("73 / 73");
  await expect(page.locator("[data-model-completeness]")).toContainText("0 / 73");
  await expect(page.locator("[data-model-completeness]")).toContainText("Font coverage is not educational-model completeness");
});

test("the German font assets are precached and a cached letter route works offline", async ({ page, context }) => {
  await page.goto("en/models/de-sas/letters/u0072/");
  await expect(page.locator("[data-font-preview-shape]")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-offline-assets-cached", "true", { timeout: 60_000 });
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator("[data-font-preview-shape]")).toBeVisible();
  await context.setOffline(false);
});

test("educational role and model family filters use recorded metadata", async ({ page }) => {
  await page.goto("en/explore/");
  await page.locator('[data-model-filter="role"]').selectOption("connected-script");
  await expect(page.locator("[data-model-card]:visible")).toHaveCount(5);
  await page.locator('[data-model-filter="role"]').selectOption("");
  await page.locator('[data-model-filter="family"]').selectOption("modern-school-script");
  await expect(page.locator("[data-model-card]:visible")).toHaveCount(4);
});

test("the comparison includes all five CTAN fonts and bounds shared overlays", async ({ page }) => {
  await page.goto("en/compare/letters/");
  const stage = page.locator("[data-multi-stage]");
  await expect(stage.locator("text")).toHaveCount(5);
  await expect(stage.locator("text")).toHaveText(["r", "r", "r", "r", "r"]);
  await expect(stage).toContainText("Grundschrift · Rendering unavailable.");
  const boxes = await stage.locator("svg").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("viewBox")));
  expect(new Set(boxes).size).toBe(1);

  await page.locator("[data-multi-mode]").selectOption("overlay");
  await expect(stage.locator("svg")).toHaveCount(0);
  await expect(page.locator("[data-multi-status]")).toContainText("at most 3");
  for (const model of ["de-deutsche-normalschrift", "de-grundschrift", "de-suetterlin"]) {
    await page.locator(`[data-multi-option] input[value="${model}"]`).uncheck();
  }
  await expect(stage.locator("svg")).toHaveCount(1);
  await expect(stage.locator("text")).toHaveText(["r", "r", "r"]);
  await page.locator('[data-multi-case="upper"]').click();
  await expect(stage.locator("text")).toHaveText(["R", "R", "R"]);
  const shared = await page.locator("[data-multi-share]").inputValue();
  await page.goto(shared);
  await expect(stage.locator("text")).toHaveText(["R", "R", "R"]);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("CTAN word and sentence fixtures preserve literal text and required shaping features", async ({ page }) => {
  for (const kind of ["words", "sentences"]) {
    await page.goto(`en/compare/${kind}/`);
    await expect(page.locator("#word-font-a")).toBeEnabled();
    for (const [modelA, modelB] of modelPairs) {
      await page.locator("#word-model-a").selectOption(modelA);
      await page.locator("#word-model-b").selectOption(modelB);
      for (const text of ["minimum", "Schule", "schreiben", "groß", "Ärger", "Über", "re", "st", "ää ß.,?!", "mmmm nn rr"]) {
        await page.locator("#word-input").fill(text);
        await expect(page.locator("#word-stage text")).toHaveText([text, text]);
        const features = await page.locator("#word-stage text").first().evaluate((node) => getComputedStyle(node).fontFeatureSettings);
        expect(features).toContain('"calt"');
        expect(features).toContain('"kern"');
        await expect(page.locator("#word-provenance")).toContainText("Version 1.0");
        await expect(page.locator("#word-provenance")).toContainText("CTAN schulschriften 5");
        const widths = await page.locator("#word-stage text").evaluateAll((nodes) => nodes.map((node) => (node as SVGTextElement).getBBox().width));
        expect(widths.every((width) => Number.isFinite(width) && width > 0)).toBe(true);
      }
    }
  }
});

test("all five CTAN models export self-contained font-backed worksheets with provenance", async ({ page }) => {
  await page.goto("en/practice/");
  await page.locator("[data-text-input]").fill("Schule");
  await page.locator("[data-reference-kind]").selectOption("font");
  for (const model of ctanModels) {
    await page.locator("[data-model-select]").selectOption(model);
    await expect(page.locator('[data-worksheet-output] [data-reference-kind="font"]')).toHaveCount(3);
    await expect(page.locator("[data-export-svg]")).toBeEnabled();
    const record = JSON.parse((await page.locator("[data-worksheet-output] metadata").textContent())!) as Record<string, any>;
    const fontId = fontIds.get(model)!;
    expect(record.referenceKind).toBe("font");
    expect(record.fontId).toBe(fontId);
    expect(record.fontVersion).toBe("Version 1.0");
    expect(record.fontLicense).toBe("LPPL-1.3c");
    expect(record.fontLicenseText).toContain("LPPL Version 1.3c");
    expect(record.fontUpstream.sha256).toBe(archiveSha256);
    expect(record.fontIntegrity.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(record.fontDerivation.recipe).toBe("tools/fonts/schulschriften/build.py");
    expect(record.fontDerivation.unicode_mapping_sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(record.fontDerivation.tfm_sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(record.fontCorrespondence.model).toBe(model);
    expect(record.fontSources).toContain("src-ctan-schulschriften-v5");
    expect(record.fontSourceRecords.map((source: { id: string }) => source.id)).toContain("src-schulschriften-manual-2014");
    expect(record.fontFileUrl).toContain("/data/v1/");
    expect(record.fontLicenseFileUrl).toMatch(/LPPL-1.3c-Schulschriften.txt$/);
    expect(record.fontProvenanceUrl).toContain("/data/v1/");
    expect(record.shaping.required_features).toEqual(["calt", "kern"]);
    expect(record.outlines).toEqual([]);
    await expect(page.locator("[data-worksheet-output] defs style")).toContainText("data:font/ttf;base64,");
    await expect(page.locator("[data-worksheet-provenance]")).toContainText("CTAN schulschriften 5");
  }

  await page.locator("[data-model-select]").selectOption("de-grundschrift");
  await expect(page.locator("[data-worksheet-status]")).toContainText("No substitute font is used");
  await expect(page.locator("[data-export-svg]")).toBeDisabled();
  await expect(page.locator("[data-worksheet-output] svg")).toHaveCount(0);
  await page.locator("[data-text-input]").fill("😀");
  await page.locator("[data-model-select]").selectOption("de-la");
  await expect(page.locator("[data-export-svg]")).toBeDisabled();
  await expect(page.locator("[data-worksheet-output] svg")).toHaveCount(0);
});

test("font-backed SVG, PNG and PDF exports retain the exact CTAN and derivative evidence", async ({ page }) => {
  await page.goto("en/practice/");
  await page.locator("[data-model-select]").selectOption("de-sas");
  await page.locator("[data-text-input]").fill("Schule");
  await page.locator("[data-reference-kind]").selectOption("font");
  await expect(page.locator("[data-export-svg]")).toBeEnabled();
  for (const format of ["svg", "png", "pdf"]) {
    const download = page.waitForEvent("download");
    await page.locator(`[data-export-${format}]`).click();
    const file = await download;
    const bytes = readFileSync((await file.path())!);
    let metadata: string;
    if (format === "png") {
      const marker = bytes.indexOf(Buffer.from("SchreibatlasWorksheet\0"));
      expect(marker).toBeGreaterThan(0);
      const length = bytes.readUInt32BE(marker - 8);
      metadata = Buffer.from(bytes.subarray(marker + 22, marker + length).toString("ascii"), "base64").toString("utf8");
    } else if (format === "pdf") {
      const encoded = bytes.toString("utf8").match(/<sa:metadata encoding="base64">([^<]+)<\/sa:metadata>/)?.[1];
      expect(encoded).toBeTruthy();
      metadata = Buffer.from(encoded!, "base64").toString("utf8");
    } else {
      const svgMetadata = bytes.toString("utf8").match(/<metadata>([\s\S]*?)<\/metadata>/)?.[1];
      expect(svgMetadata).toBeTruthy();
      metadata = svgMetadata!
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, "\"")
        .replace(/&apos;/g, "'")
        .replace(/&amp;/g, "&");
    }
    const record = JSON.parse(metadata) as Record<string, any>;
    expect(record.fontId).toBe("font-schulschriften-sas");
    expect(record.fontVersion).toBe("Version 1.0");
    expect(record.fontLicenseText).toContain("LPPL Version 1.3c");
    expect(record.fontUpstream.sha256).toBe(archiveSha256);
    expect(record.fontIntegrity.sha256).toBe("aa1646241a14f5c4b682e5c62da691ff4c7ae1a71840ff823159b00a78c0d207");
    expect(record.fontDerivation.unicode_mapping_sha256).toBe("d3ec5d50b24fe64aa5ff7e85c55c4a736f00ad964220c0b9bfd3e32986b3ceba");
    expect(record.fontDerivation.tfm_sha256).toBe("6ae45a2a4ce227ee30d621be6713bfc14b1b7486ffc0f0b66208b43b5a5a5d44");
    expect(record.fontCorrespondence.model).toBe("de-sas");
    expect(record.fontSourceRecords.map((source: { id: string }) => source.id)).toContain("src-ctan-schulschriften-v5");
    expect(bytes.length).toBeGreaterThan(1000);
  }
});

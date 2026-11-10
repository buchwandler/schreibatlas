// SPDX-License-Identifier: Apache-2.0
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync } from "node:fs";

const models = ["de-grundschrift", "de-la", "de-sas", "de-va"];
for (const lang of ["de", "en"]) {
  test(`${lang}: modern letter pages expose loaded reference fonts, not invented glyph evidence`, async ({ page }) => {
    for (const model of models) {
      await page.goto(`${lang}/models/${model}/letters/u0072/`);
      await expect(page.locator("[data-font-preview-shape]")).toBeVisible();
      await expect(page.locator("[data-glyph-outline]")).toHaveCount(0);
      await expect(page.locator("[data-font-preview]")).toContainText("Version 1.003");
      await expect(page.locator("[data-font-preview] a").first()).toHaveAttribute("href", /OFL-1.1-Playwrite.txt$/);
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    }
  });
}

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
  await expect(page.locator("[data-model-card]:visible")).toHaveCount(3);
  await page.locator('[data-model-filter="role"]').selectOption("");
  await page.locator('[data-model-filter="family"]').selectOption("modern-school-script");
  await expect(page.locator("[data-model-card]:visible")).toHaveCount(4);
});

test("four German models compare r on aligned stages with bounded overlay and share state", async ({ page }) => {
  await page.goto("en/compare/letters/");
  const stage = page.locator("[data-multi-stage]");
  await expect(stage.locator("text")).toHaveCount(4);
  await expect(stage.locator("text")).toHaveText(["r", "r", "r", "r"]);
  const boxes = await stage.locator("svg").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("viewBox")));
  expect(new Set(boxes).size).toBe(1);
  await page.locator("[data-multi-mode]").selectOption("overlay");
  await expect(stage.locator("svg")).toHaveCount(0);
  await expect(page.locator("[data-multi-status]")).toContainText("at most 3");
  const va = page.locator('[data-multi-option] input[value="de-va"]');
  await va.focus();
  await page.keyboard.press("Space");
  await expect(stage.locator("svg")).toHaveCount(1);
  await expect(stage.locator("text")).toHaveCount(3);
  await page.locator('[data-multi-case="upper"]').click();
  await expect(stage.locator("text")).toHaveText(["R", "R", "R"]);
  const shared = await page.locator("[data-multi-share]").inputValue();
  await page.goto(shared);
  await expect(stage.locator("text")).toHaveText(["R", "R", "R"]);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("Playwrite word and sentence fixtures preserve literal text and explicit shaping features", async ({ page }) => {
  for (const kind of ["words", "sentences"]) {
    await page.goto(`en/compare/${kind}/`);
    await expect(page.locator("#word-font-a")).toBeEnabled();
    for (let index = 0; index < models.length; index += 2) {
      await page.locator("#word-model-a").selectOption(models[index]);
      await page.locator("#word-model-b").selectOption(models[index + 1]);
      for (const text of ["minimum", "Schule", "schreiben", "groß", "Ärger", "Über", "re", "st", "ää ß.,?!", "mmmm nn rr"]) {
        await page.locator("#word-input").fill(text);
        await expect(page.locator("#word-stage text")).toHaveText([text, text]);
        const features = await page.locator("#word-stage text").first().evaluate((node) => getComputedStyle(node).fontFeatureSettings);
        expect(features).toContain('"calt"');
        expect(features).toContain('"kern"');
        await expect(page.locator("#word-provenance")).toContainText("Version 1.003");
        const widths = await page.locator("#word-stage text").evaluateAll((nodes) => nodes.map((node) => (node as SVGTextElement).getBBox().width));
        expect(widths.every((width) => Number.isFinite(width) && width > 0)).toBe(true);
      }
    }
  }
});

test("all four modern models export self-contained font-backed worksheets with provenance", async ({ page }) => {
  await page.goto("en/practice/");
  await page.locator("[data-text-input]").fill("Schule");
  await page.locator("[data-reference-kind]").selectOption("font");
  for (const model of models) {
    await page.locator("[data-model-select]").selectOption(model);
    await expect(page.locator("[data-worksheet-output] [data-reference-kind=font]")).toHaveCount(3);
    await expect(page.locator("[data-export-svg]")).toBeEnabled();
    const metadata = await page.locator("[data-worksheet-output] metadata").textContent();
    const record = JSON.parse(metadata!);
    expect(record.referenceKind).toBe("font");
    expect(record.fontVersion).toBe("Version 1.003");
    expect(record.fontLicenseText).toContain("Copyright 2023 The Playwrite Project Authors");
    expect(record.outlines).toEqual([]);
    await expect(page.locator("[data-worksheet-output] defs style")).toContainText("data:font/ttf;base64,");
    await expect(page.locator("[data-worksheet-provenance]")).toContainText("Reference font:");
  }
  await page.locator("[data-text-input]").fill("😀");
  await expect(page.locator("[data-export-svg]")).toBeDisabled();
  await expect(page.locator("[data-worksheet-output] svg")).toHaveCount(0);
});

test("font-backed SVG, PNG and PDF exports retain the exact font and OFL provenance", async ({ page }) => {
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
    } else metadata = bytes.toString("utf8");
    expect(metadata.includes("font-playwrite-de-sas")).toBe(true);
    expect(metadata.includes("Version 1.003")).toBe(true);
    expect(metadata.includes("Copyright 2023 The Playwrite Project Authors")).toBe(true);
    expect(bytes.length).toBeGreaterThan(1000);
  }
});

// SPDX-License-Identifier: Apache-2.0
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const sasGroupCounts = {
  uppercase: 26,
  lowercase: 26,
  special: 7,
  numerals: 10,
  punctuation: 4,
};

test("SAS specimen loads its local font and renders every recorded group", async ({ page }) => {
  await page.goto("de/models/de-sas/");

  const specimen = page.locator("[data-alphabet-specimen]");
  await expect(specimen).toHaveAttribute("data-state", "ready");
  await expect(specimen).toHaveAttribute("data-font-id", "font-schulschriften-sas");
  await expect(specimen.locator("[data-specimen-group]")).toHaveCount(5);
  await expect(specimen.locator("[data-specimen-character]")).toHaveCount(73);

  for (const [group, count] of Object.entries(sasGroupCounts)) {
    await expect(specimen.locator(`[data-specimen-group="${group}"] [data-specimen-character]`)).toHaveCount(count);
  }

  const family = "alphabet-font-schulschriften-sas";
  const localFontLoaded = await page.evaluate((family) => {
    return Array.from(document.fonts).some((face) => face.family === family && face.status === "loaded");
  }, family);
  expect(localFontLoaded).toBe(true);
  const glyphFamilies = await specimen.locator("[data-specimen-character]").evaluateAll((glyphs) => {
    const families = glyphs.map((glyph) => getComputedStyle(glyph).fontFamily.replace(/^["']|["']$/g, ""));
    return Array.from(new Set(families));
  });
  expect(glyphFamilies).toEqual([family]);
  await expect(specimen.locator("[data-alphabet-sheet]")).toBeVisible();
  await expect(specimen.locator(".alphabet-specimen-disclaimer")).toContainText("Keine offizielle Alphabettafel");
});

test("blocked SAS font stays hidden and reports no substitute font", async ({ page }) => {
  await page.route("**/*.ttf", (route) => route.abort());
  await page.goto("en/models/de-sas/");

  const specimen = page.locator("[data-alphabet-specimen]");
  await expect(specimen).toHaveAttribute("data-state", "unavailable");
  await expect(specimen.locator("[data-alphabet-status]")).toContainText("no substitute font is used");
  await expect(specimen.locator("[data-alphabet-sheet]")).toBeHidden();
  const loadedSpecimenFonts = await page.evaluate(() => Array.from(document.fonts).filter((face) => face.family === "alphabet-font-schulschriften-sas" && face.status === "loaded").length);
  expect(loadedSpecimenFonts).toBe(0);
});

test("English SAS specimen exposes translated group labels", async ({ page }) => {
  await page.goto("en/models/de-sas/");

  const specimen = page.locator("[data-alphabet-specimen]");
  await expect(specimen).toHaveAttribute("data-state", "ready");
  await expect(specimen.locator('[data-specimen-group="uppercase"] h3')).toHaveText("Uppercase");
  await expect(specimen.locator('[data-specimen-group="lowercase"] h3')).toHaveText("Lowercase");
  await expect(specimen.locator('[data-specimen-group="special"] h3')).toHaveText("Special characters");
  await expect(specimen.locator('[data-specimen-group="numerals"] h3')).toHaveText("Numerals");
  await expect(specimen.locator('[data-specimen-group="punctuation"] h3')).toHaveText("Punctuation");
  await expect(specimen.locator(".alphabet-specimen-disclaimer")).toContainText("Not an official alphabet chart");
});

test("Kurrent specimen is explicitly identified as a visual approximation", async ({ page }) => {
  await page.goto("en/models/de-kurrent-loth-1866/");

  const specimen = page.locator("[data-alphabet-specimen]");
  await expect(specimen).toHaveAttribute("data-state", "ready");
  await expect(specimen).toContainText("visual approximation");
  await expect(specimen.locator(".alphabet-specimen-disclaimer")).toContainText("Not an official alphabet chart");
});

test("Grundschrift has a visual reference alphabet specimen", async ({ page }) => {
  await page.goto("en/models/de-grundschrift/");
  const specimen = page.locator("[data-alphabet-specimen]");
  await expect(specimen).toHaveAttribute("data-state", "ready");
  await expect(specimen).toHaveAttribute("data-font-id", "font-urff-grundschrift");
  await expect(specimen.locator("[data-specimen-character]")).toHaveCount(73);
  await expect(specimen).toContainText("visual approximation");
});

test("alphabet specimen model pages pass the automated WCAG audit", async ({ page }) => {
  for (const route of ["de/models/de-sas/", "en/models/de-sas/", "en/models/de-kurrent-loth-1866/"]) {
    await page.goto(route);
    await expect(page.locator("[data-alphabet-specimen]")).toHaveAttribute("data-state", "ready");
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
    expect(results.violations, `${route}: ${JSON.stringify(results.violations.map(({ id, description, nodes }) => ({ id, description, nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })) })))}`).toEqual([]);
  }
});

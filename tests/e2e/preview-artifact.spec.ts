// SPDX-License-Identifier: Apache-2.0
import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

if (process.env.GENERATE_PREVIEW_ARTIFACTS === "true") {
  test("PR visual preview screenshots", async ({ page }) => {
    const outputDirectory = join(process.cwd(), "test-results", "pr-preview");
    mkdirSync(outputDirectory, { recursive: true });
    const pages = [
      ["de-home", "de/"],
      ["en-home", "en/"],
      ["de-analysis", "de/analyze/"],
      ["en-about", "en/about/"],
      ["de-volksschrift-letter-a", "de/models/de-volksschrift/letters/u0061/"],
      ["de-sas-alphabet-specimen", "de/models/de-sas/"],
    ];
    for (const [name, route] of pages) {
      await page.goto(route);
      await expect(page.locator("h1").first()).toBeVisible();
      if (route === "de/models/de-sas/") {
        const specimen = page.locator("[data-alphabet-specimen]");
        await expect(specimen).toHaveAttribute("data-state", "ready");
        for (const group of ["uppercase", "lowercase"]) {
          await specimen.locator(`[data-specimen-group="${group}"] .alphabet-specimen-row`).screenshot({
            path: join(outputDirectory, `sas-standard-inclination-${group}.png`),
            animations: "disabled",
          });
        }
      }
      await page.screenshot({ path: join(outputDirectory, `${name}.png`), fullPage: true, animations: "disabled" });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("de/models/de-sas/");
    await expect(page.locator("[data-alphabet-specimen]")).toHaveAttribute("data-state", "ready");
    const widths = await page.evaluate(() => ({ document: document.documentElement.scrollWidth, viewport: document.documentElement.clientWidth }));
    expect(widths.document).toBeLessThanOrEqual(widths.viewport);
    await page.screenshot({ path: join(outputDirectory, "de-sas-alphabet-mobile.png"), fullPage: true, animations: "disabled" });
    await page.emulateMedia({ media: "print" });
    await expect(page.locator("[data-alphabet-sheet]")).toBeVisible();
    await expect(page.locator(".alphabet-specimen-attribution")).toBeVisible();
    await expect(page.locator(".alphabet-specimen-disclaimer")).toBeVisible();
    await page.screenshot({ path: join(outputDirectory, "de-sas-alphabet-print.png"), fullPage: true, animations: "disabled" });
  });
}

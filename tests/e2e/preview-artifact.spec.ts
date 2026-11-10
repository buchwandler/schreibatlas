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
    ];
    for (const [name, route] of pages) {
      await page.goto(route);
      await expect(page.locator("h1").first()).toBeVisible();
      await page.screenshot({ path: join(outputDirectory, `${name}.png`), fullPage: true, animations: "disabled" });
    }
  });
}

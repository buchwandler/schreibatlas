// SPDX-License-Identifier: Apache-2.0
import fs from "node:fs";
import { chromium } from "playwright";

const fontPath = process.env.SAS_FONT_PATH;
const samplesPath = process.env.SAS_SAMPLES_PATH;
const resultPath = process.env.SAS_BROWSER_RESULT_PATH;
const samplesScreenshotPath = process.env.SAS_SAMPLES_SCREENSHOT_PATH;
const visualScreenshotPath = process.env.SAS_VISUAL_SCREENSHOT_PATH;
const fontFamily = process.env.SAS_FONT_FAMILY;
const profileId = process.env.SAS_PROFILE_ID;
if (!fontFamily || !profileId) throw new Error("SAS_FONT_FAMILY and SAS_PROFILE_ID are required");
const samples = JSON.parse(fs.readFileSync(samplesPath, "utf8"));
const fontData = fs.readFileSync(fontPath).toString("base64");
const playwrightPackage = JSON.parse(fs.readFileSync(new URL("../../../node_modules/playwright/package.json", import.meta.url), "utf8"));
const startMarker = "\u00A7";
const endMarker = "\u00B6";

function addWordBoundaries(value) {
  if (value.includes(startMarker) || value.includes(endMarker)) {
    throw new Error("Word-boundary markers are reserved and cannot appear in source text");
  }
  return value.replace(/\S+/gu, (word) => `${startMarker}${word}${endMarker}`);
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  args: ["--no-sandbox"],
});
const page = await browser.newPage({
  viewport: { width: 900, height: samples.cases.length * 88 + 16 },
  deviceScaleFactor: 1,
});
const sampleRows = samples.cases.map((word, index) =>
  `<div class="sample-row"><span id="sample-${index}" class="sas-text">${escapeHtml(addWordBoundaries(word))}</span><span class="label">${escapeHtml(word)}</span></div>`,
).join("");
const visualRows = samples.visual_cases.concat(samples.visual_glyph_cases).map((word) =>
  `<div class="visual-row"><span class="sas-text">${escapeHtml(addWordBoundaries(word))}</span></div>`,
).join("");

await page.setContent(`<style>
@font-face {
  font-family: "${fontFamily}";
  src: url(data:font/ttf;base64,${fontData}) format("truetype");
}
html, body { margin: 0; background: white; color: #111; }
.sample-row { height: 88px; white-space: nowrap; }
.sas-text { display: inline-block; font-family: "${fontFamily}"; font-size: ${samples.browser_font_size_px}px; font-feature-settings: "calt" 1, "kern" 1; }
.label { margin-left: 20px; font: 16px sans-serif; vertical-align: top; }
.visual-row { height: 80px; white-space: nowrap; }
</style><main>${sampleRows}</main>`);
await page.evaluate(async () => { await document.fonts.ready; });
const fontLoaded = await page.evaluate(async ({ family, size }) => {
  const loaded = await document.fonts.load(`${size}px "${family}"`);
  await document.fonts.ready;
  return loaded.length > 0 && document.fonts.check(`${size}px "${family}"`);
}, { family: fontFamily, size: samples.browser_font_size_px });
if (!fontLoaded) throw new Error(`Browser did not load ${fontFamily}`);
const browserWidths = await page.evaluate((count) =>
  Array.from({ length: count }, (_, index) =>
    document.getElementById(`sample-${index}`).getBoundingClientRect().width,
  ),
  samples.cases.length,
);
const browserVersion = browser.version();
await page.screenshot({ path: samplesScreenshotPath, fullPage: true });

await page.setViewportSize({ width: Math.ceil(500 * 96 / 72), height: (samples.visual_cases.length + samples.visual_glyph_cases.length) * 80 });
await page.setContent(`<style>
@font-face {
  font-family: "${fontFamily}";
  src: url(data:font/ttf;base64,${fontData}) format("truetype");
}
html, body { margin: 0; background: white; }
.visual-row { height: 80px; padding-left: 24px; box-sizing: border-box; white-space: nowrap; }
.sas-text { font-family: "${fontFamily}"; font-size: ${samples.browser_font_size_px}px; font-feature-settings: "calt" 1, "kern" 1; }
</style><main>${visualRows}</main>`);
await page.evaluate(async () => { await document.fonts.ready; });
await page.screenshot({ path: visualScreenshotPath, fullPage: true });
await browser.close();

fs.writeFileSync(resultPath, JSON.stringify({ profileId, fontFamily, fontLoaded, browserVersion, nodeVersion: process.version, playwrightVersion: playwrightPackage.version, browserWidths }, null, 2) + "\n");
console.log(`Chromium ${browserVersion}, Playwright ${playwrightPackage.version}, Node ${process.version}`);

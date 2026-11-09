import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

test("software package metadata identifies Apache-2.0", () => {
  assert.equal(packageJson.license, "Apache-2.0");
});

test("localized home copy identifies demo status", () => {
  const messages = readFileSync(new URL("../src/lib/i18n.ts", import.meta.url), "utf8");
  const germanPage = readFileSync(new URL("../src/pages/de/index.astro", import.meta.url), "utf8");
  const englishPage = readFileSync(new URL("../src/pages/en/index.astro", import.meta.url), "utf8");
  assert.match(messages, /Demo-Daten, keine verifizierten Standards/);
  assert.match(messages, /Demo data, not verified standards/);
  assert.match(germanPage, /messages\.de/);
  assert.match(englishPage, /messages\.en/);
});


test("legacy application script contains no hard-coded handwriting records", () => {
  const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  assert.doesNotMatch(app, /demoModels|specialInstructions|const ALPHABET/);
  assert.match(app, /data\/models/);
});

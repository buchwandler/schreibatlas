// SPDX-License-Identifier: Apache-2.0
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { spdxHeaderErrors } from "../tools/check-spdx-headers.mjs";
import { parse } from "yaml";

const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

test("software package metadata identifies Apache-2.0", () => {
  assert.equal(packageJson.license, "Apache-2.0");
});

test("localized home copy identifies demo status", () => {
  const messages = readFileSync(new URL("../src/lib/i18n.ts", import.meta.url), "utf8");
  const germanPage = readFileSync(new URL("../src/pages/de/index.astro", import.meta.url), "utf8");
  const englishPage = readFileSync(new URL("../src/pages/en/index.astro", import.meta.url), "utf8");
  assert.match(messages, /Kleines Teilkorpus, keine vollständigen Standards/);
  assert.match(messages, /Zwei deutsche Schreibmodelle sind quellenbasiert dokumentiert/);
  assert.match(messages, /Small partial corpus, not complete standards/);
  assert.match(messages, /Photo analysis processes images locally/);
  assert.match(germanPage, /messages\.de/);
  assert.match(englishPage, /messages\.en/);
});


test("legacy application script contains no hard-coded handwriting records", () => {
  const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  assert.doesNotMatch(app, /demoModels|specialInstructions|const ALPHABET/);
  assert.match(app, /data\/models/);
});

test("source files carry SPDX headers matching the license policy", () => {
  assert.deepEqual(spdxHeaderErrors(), []);
});

test("release and pull request preview workflows declare their controlled outputs", () => {
  const release = parse(readFileSync(new URL("../.github/workflows/data-release.yml", import.meta.url), "utf8"));
  const preview = parse(readFileSync(new URL("../.github/workflows/preview.yml", import.meta.url), "utf8"));
  assert.equal(release.on.workflow_dispatch.inputs.version.required, true);
  assert.equal(release.jobs.release.if, "github.ref == 'refs/heads/main'");
  assert.ok(release.jobs.release.steps.some((step) => step.run === "npm run validate"));
  assert.ok(release.jobs.release.steps.some((step) => step.run?.includes("gh release create")));
  assert.equal(preview.permissions.contents, "read");
  assert.ok(preview.jobs.preview.steps.some((step) => step.with?.name === "schreibatlas-pr-visual-preview"));
});

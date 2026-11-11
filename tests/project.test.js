// SPDX-License-Identifier: Apache-2.0
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { spdxHeaderErrors } from "../tools/check-spdx-headers.mjs";
import { parse } from "yaml";

import { fontNoticeErrors, projectContentErrors, relativeLinkErrors } from "../tools/project-checks.mjs";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));

test("README links, font notices and Node versions are consistent", () => {
  assert.deepEqual(projectContentErrors(projectRoot), []);
});

test("local link checks reject missing targets but ignore external URLs and fragments", () => {
  assert.deepEqual(relativeLinkErrors("[readme](README.md#development) [web](https://example.org/) [anchor](#here)", "README.md", projectRoot), []);
  assert.equal(relativeLinkErrors("[missing](missing-file.md)", "README.md", projectRoot).length, 1);
});

test("font notices must identify each exact font record", () => {
  assert.deepEqual(fontNoticeErrors([{ id: "font-test" }], "`font-test`"), []);
  assert.equal(fontNoticeErrors([{ id: "font-test" }], "font-test-other").length, 1);
});
const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

test("software package metadata identifies Apache-2.0", () => {
  assert.equal(packageJson.license, "Apache-2.0");
});

test("localized home copy identifies demo status", () => {
  const messages = readFileSync(new URL("../src/lib/i18n.ts", import.meta.url), "utf8");
  const germanPage = readFileSync(new URL("../src/pages/de/index.astro", import.meta.url), "utf8");
  const englishPage = readFileSync(new URL("../src/pages/en/index.astro", import.meta.url), "utf8");
  assert.match(messages, /Kleines Teilkorpus, keine vollständigen Standards/);
  assert.match(messages, /Acht deutsche Schreibmodelle sind quellenbasiert dokumentiert/);
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

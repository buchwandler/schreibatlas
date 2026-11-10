// SPDX-License-Identifier: Apache-2.0
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { packageDatasetRelease } from "../../tools/package-data-release.mjs";

function fixtureRoot(t) {
  const root = mkdtempSync(join(tmpdir(), "schreibatlas-release-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const [path, value] of [
    ["data/models/example/model.yaml", "id: example\n"],
    ["public/data/v1/index.json", "{\"schemaVersion\":1}\n"],
    ["public/data/v1/assets/fonts/example.ttf", "font fixture"],
    ["licenses/OFL.txt", "third party license"],
    ["LICENSE", "software license"],
    ["LICENSE-CONTENT", "content license"],
    ["THIRD_PARTY_NOTICES.md", "third-party notices"],
  ]) {
    const fullPath = join(root, path);
    mkdirSync(join(fullPath, ".."), { recursive: true });
    writeFileSync(fullPath, value);
  }
  return root;
}

test("dataset release includes canonical data, exports, notices, manifest, and checksums", (t) => {
  const root = fixtureRoot(t);
  const result = packageDatasetRelease({ root, version: "1.2.3", outputDir: join(root, "out"), createArchive: false });
  assert.equal(result.archive, null);
  assert.equal(result.manifest.corpusStatus, "partial");
  assert.ok(result.manifest.notes.some((note) => note.includes("not a complete or authoritative")));
  assert.ok(result.manifest.files.some(({ path }) => path === "data/models/example/model.yaml"));
  assert.ok(result.manifest.files.some(({ path }) => path === "public/data/v1/assets/fonts/example.ttf"));
  assert.equal(JSON.parse(readFileSync(result.manifestPath, "utf8")).datasetVersion, "1.2.3");

  const checksums = readFileSync(result.checksumsPath, "utf8").trim().split("\n");
  assert.ok(checksums.some((line) => line.endsWith("  dataset-manifest.json")));
  for (const line of checksums) {
    const [expected, path] = line.split("  ");
    const actual = createHash("sha256").update(readFileSync(join(result.packageDirectory, path))).digest("hex");
    assert.equal(actual, expected, path);
  }
});

test("dataset release rejects non-semantic versions before creating output", (t) => {
  const root = fixtureRoot(t);
  const outputDir = join(root, "out");
  assert.throws(() => packageDatasetRelease({ root, version: "01.2.3", outputDir }), /stable semantic version/);
  assert.throws(() => packageDatasetRelease({ root, version: "../latest", outputDir }), /stable semantic version/);
  assert.equal(existsSync(outputDir), false);
});

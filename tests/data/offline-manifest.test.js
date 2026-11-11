// SPDX-License-Identifier: Apache-2.0
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { buildOfflinePrecacheUrls, shouldPrecacheFile, writeOfflinePrecacheManifest } from "../../tools/build-offline-manifest.mjs";
import { buildData } from "../../tools/build-data.mjs";

test("offline precache includes static routes and resources under the deployment base", () => {
  const urls = buildOfflinePrecacheUrls([
    "index.html",
    "de/index.html",
    "de/analyze/index.html",
    "_astro/photo-analysis.js",
    "data/v1/fonts.json",
    "assets/fonts/reference.woff2",
    "sw.js",
  ], "/preview");
  assert.ok(urls.includes("/preview/"));
  assert.ok(urls.includes("/preview/de/"));
  assert.ok(urls.includes("/preview/de/analyze/"));
  assert.ok(urls.includes("/preview/_astro/photo-analysis.js"));
  assert.ok(urls.includes("/preview/data/v1/fonts.json"));
  assert.ok(urls.includes("/preview/assets/fonts/reference.woff2"));
  assert.ok(urls.includes("/preview/offline-precache.json"));
  assert.ok(!urls.some((url) => url.endsWith("/sw.js")));
});

test("offline precache excludes user uploads and generated reports", () => {
  assert.equal(shouldPrecacheFile("uploads/handwriting.png"), false);
  assert.equal(shouldPrecacheFile("user-content/photo.jpg"), false);
  assert.equal(shouldPrecacheFile("reports/photo-analysis.json"), false);
  assert.equal(shouldPrecacheFile("data/v1/assets/fonts/reference.ttf"), true);
  const urls = buildOfflinePrecacheUrls(["uploads/handwriting.png", "reports/photo-analysis.json", "data/v1/index.json"]);
  assert.deepEqual(urls, ["/data/v1/index.json", "/offline-precache.json"]);
});

test("build writes a sorted manifest from static files without the service worker or user data", (t) => {
  const root = mkdtempSync(join(tmpdir(), "schreibatlas-offline-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const path of ["de/index.html", "sw.js", "uploads/photo.png", "data/v1/fonts.json"]) {
    const fullPath = join(root, path);
    mkdirSync(join(fullPath, ".."), { recursive: true });
    writeFileSync(fullPath, path === "sw.js" ? 'const CACHE_NAME = "schreibatlas-static-dev";' : "fixture");
  }
  const manifest = writeOfflinePrecacheManifest({ root, basePath: "/preview" });
  const written = JSON.parse(readFileSync(join(root, "offline-precache.json"), "utf8"));
  assert.match(manifest.cacheName, /^schreibatlas-static-[a-f0-9]{16}$/);
  assert.ok(readFileSync(join(root, "sw.js"), "utf8").includes(`const CACHE_NAME = "${manifest.cacheName}";`));
  assert.deepEqual(written, manifest);
  assert.deepEqual(manifest.urls, [...manifest.urls].sort());
  assert.ok(manifest.urls.includes("/preview/de/"));
  assert.ok(manifest.urls.includes("/preview/data/v1/fonts.json"));
  assert.ok(!manifest.urls.some((url) => /uploads|sw\.js/.test(url)));
});

test("CTAN font files, licenses, provenance, sources, and hashes are available offline", (t) => {
  const root = mkdtempSync(join(tmpdir(), "schreibatlas-offline-fonts-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const dataDirectory = join(root, "data/v1");
  const result = buildData({ outputDir: dataDirectory, basePath: "/preview" });
  const manifest = writeOfflinePrecacheManifest({ root, basePath: "/preview" });
  const fonts = JSON.parse(readFileSync(join(dataDirectory, "fonts.json"), "utf8"));
  const sources = JSON.parse(readFileSync(join(dataDirectory, "sources.json"), "utf8"));
  const sourceIds = new Set(sources.map(({ id }) => id));
  assert.ok(manifest.urls.includes("/preview/data/v1/fonts.json"));
  assert.ok(manifest.urls.includes("/preview/data/v1/sources.json"));
  for (const id of ["font-schulschriften-la", "font-schulschriften-sas", "font-schulschriften-va", "font-schulschriften-suetterlin", "font-schulschriften-dn"]) {
    const font = fonts.find((entry) => entry.id === id);
    assert.ok(font, `${id} should be in the dataset export`);
    assert.ok(font.integrity?.sha256);
    assert.ok(font.upstream?.sha256);
    assert.ok(font.derivation?.recipe);
    assert.ok(font.derivation?.unicode_mapping_sha256);
    assert.ok(font.derivation?.tfm_sha256);
    assert.ok(font.sources.length > 0 && font.sources.every((sourceId) => sourceIds.has(sourceId)));
    for (const url of [...font.file_urls, font.license_file_url, font.derivation.provenance_file_url]) {
      assert.ok(url && manifest.urls.includes(url), `${id} asset ${url} should be precached`);
    }
    const provenancePath = font.derivation.provenance_file_url.replace("/preview/data/v1/", "");
    const provenance = JSON.parse(readFileSync(join(dataDirectory, provenancePath), "utf8"));
    assert.equal(provenance.upstream.archive_sha256, font.upstream.sha256);
    assert.equal(provenance.artifact.sha256, font.integrity.sha256);
  }
  assert.ok(result.files.includes("sources.json"));
});

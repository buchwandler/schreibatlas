// SPDX-License-Identifier: Apache-2.0
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { buildOfflinePrecacheUrls, shouldPrecacheFile, writeOfflinePrecacheManifest } from "../../tools/build-offline-manifest.mjs";

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

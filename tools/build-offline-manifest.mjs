// SPDX-License-Identifier: Apache-2.0
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const excludedDirectoryNames = new Set(["uploads", "user-uploads", "user-content", "reports", "user-reports"]);

function collectFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? collectFiles(path) : entry.isFile() ? [path] : [];
  }).sort();
}

function normalizeBasePath(value) {
  const basePath = value.trim().replace(/^\/+|\/+$/g, "");
  if (basePath.split("/").some((segment) => segment === "." || segment === "..")) throw new Error("SITE_BASE_PATH must not contain dot segments.");
  return basePath ? `/${basePath}` : "";
}

function normalizeFilePath(value) {
  const path = value.replaceAll("\\", "/").replace(/^\/+/, "");
  if (!path || path.split("/").some((segment) => segment === "." || segment === "..")) throw new Error(`Invalid offline asset path: ${value}`);
  return path;
}

function cacheNameFor(root, filePaths) {
  const hash = createHash("sha256");
  for (const path of [...filePaths].filter((value) => value !== "offline-precache.json").sort()) {
    let content = readFileSync(resolve(root, path));
    if (path === "sw.js") content = Buffer.from(content.toString("utf8").replace(/const CACHE_NAME = \"schreibatlas-static-[^\"]+\";/, 'const CACHE_NAME = "schreibatlas-static-dev";'));
    hash.update(path).update("\0").update(content).update("\0");
  }
  return `schreibatlas-static-${hash.digest("hex").slice(0, 16)}`;
}

export function shouldPrecacheFile(value) {
  const path = normalizeFilePath(value);
  if (path === "sw.js") return false;
  return !path.split("/").some((segment) => excludedDirectoryNames.has(segment.toLowerCase()));
}

export function buildOfflinePrecacheUrls(filePaths, basePath = "") {
  const base = normalizeBasePath(basePath);
  const urls = new Set([`${base}/offline-precache.json`]);
  for (const value of filePaths) {
    const path = normalizeFilePath(value);
    if (!shouldPrecacheFile(path)) continue;
    urls.add(`${base}/${path}`);
    if (path.endsWith("/index.html")) urls.add(`${base}/${path.slice(0, -"index.html".length)}`);
    else if (path === "index.html") urls.add(`${base}/`);
  }
  return [...urls].sort();
}

export function writeOfflinePrecacheManifest({ root = resolve(projectRoot, "dist"), basePath = process.env.SITE_BASE_PATH ?? "" } = {}) {
  const absoluteRoot = resolve(root);
  const filePaths = collectFiles(absoluteRoot).map((path) => relative(absoluteRoot, path).split(sep).join("/"));
  const cacheName = cacheNameFor(absoluteRoot, filePaths);
  const manifest = { schemaVersion: 1, cacheName, urls: buildOfflinePrecacheUrls(filePaths, basePath) };
  writeFileSync(resolve(absoluteRoot, "offline-precache.json"), `${JSON.stringify(manifest, null, 2)}\n`);

  const workerPath = resolve(absoluteRoot, "sw.js");
  if (existsSync(workerPath)) {
    const worker = readFileSync(workerPath, "utf8");
    const builtWorker = worker.replace(/const CACHE_NAME = \"schreibatlas-static-[^\"]+\";/, `const CACHE_NAME = "${cacheName}";`);
    if (builtWorker === worker) throw new Error("Service worker cache name marker is missing.");
    writeFileSync(workerPath, builtWorker);
  }
  return manifest;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const manifest = writeOfflinePrecacheManifest();
  console.log(`Generated offline precache manifest with ${manifest.urls.length} URLs (${manifest.cacheName}).`);
}

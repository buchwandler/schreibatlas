// SPDX-License-Identifier: Apache-2.0
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, join, relative, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const requiredNotices = ["LICENSE", "LICENSE-CONTENT", "THIRD_PARTY_NOTICES.md"];

function filesUnder(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(path) : entry.isFile() ? [path] : [];
  }).sort();
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

export function packageDatasetRelease({ root = projectRoot, version, outputDir = resolve(root, "release-artifacts"), createArchive = true } = {}) {
  if (typeof version !== "string" || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) throw new Error("Dataset release version must be a stable semantic version (X.Y.Z).");
  const repositoryRoot = resolve(root);
  const outputRoot = resolve(outputDir);
  const releaseName = `schreibatlas-data-v${version}`;
  const packageDirectory = join(outputRoot, releaseName);
  if (existsSync(packageDirectory)) throw new Error(`Release package already exists: ${packageDirectory}`);
  mkdirSync(outputRoot, { recursive: true });

  cpSync(join(repositoryRoot, "data"), join(packageDirectory, "data"), { recursive: true });
  cpSync(join(repositoryRoot, "public/data/v1"), join(packageDirectory, "public/data/v1"), { recursive: true });
  cpSync(join(repositoryRoot, "licenses"), join(packageDirectory, "licenses"), { recursive: true });
  for (const notice of requiredNotices) cpSync(join(repositoryRoot, notice), join(packageDirectory, notice));

  const includedFiles = filesUnder(packageDirectory).map((path) => ({
    path: relative(packageDirectory, path).split(sep).join("/"),
    sha256: sha256(path),
  }));
  const manifest = {
    schemaVersion: 1,
    datasetVersion: version,
    corpusStatus: "partial",
    licensing: { software: "Apache-2.0", content: "CC-BY-SA-4.0", thirdPartyNotices: "THIRD_PARTY_NOTICES.md" },
    notes: [
      "This is a partial research corpus, not a complete or authoritative handwriting repertoire.",
      "Consult each model, source, and font record for scope, correspondence, verification, and licensing limits.",
      "Font outlines are digital reference data and do not establish handwriting movement or stroke order.",
    ],
    files: includedFiles,
  };
  writeFileSync(join(packageDirectory, "dataset-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  const checksummedFiles = filesUnder(packageDirectory).map((path) => `${sha256(path)}  ${relative(packageDirectory, path).split(sep).join("/")}`);
  writeFileSync(join(packageDirectory, "SHA256SUMS"), `${checksummedFiles.join("\n")}\n`);

  let archive = null;
  let archiveChecksum = null;
  if (createArchive) {
    archive = join(outputRoot, `${releaseName}.zip`);
    const zip = spawnSync("zip", ["-X", "-q", "-r", archive, releaseName], { cwd: outputRoot, encoding: "utf8" });
    if (zip.error || zip.status !== 0) throw new Error(`Could not create dataset release ZIP: ${zip.error?.message ?? zip.stderr ?? zip.status}`);
    archiveChecksum = `${sha256(archive)}  ${basename(archive)}\n`;
    writeFileSync(`${archive}.sha256`, archiveChecksum);
  }
  return { packageDirectory, manifestPath: join(packageDirectory, "dataset-manifest.json"), checksumsPath: join(packageDirectory, "SHA256SUMS"), archive, archiveChecksum, manifest };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [version, outputDir] = process.argv.slice(2);
  if (!version || !outputDir) throw new Error("Usage: node tools/package-data-release.mjs X.Y.Z OUTPUT_DIR");
  const result = packageDatasetRelease({ version, outputDir });
  console.log(`Packaged ${result.archive} with ${result.manifest.files.length} source and export files.`);
}

// SPDX-License-Identifier: Apache-2.0
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const scannedDirectories = ["src", "tools", "tests", "data", ".github", "docs", "templates"];
const rootFiles = [".codecrate.toml", "CONTRIBUTING.md", "README.md", "THIRD_PARTY_NOTICES.md", "app.js", "astro.config.mjs", "index.html", "playwright.config.ts", "styles.css", "public/sw.js"];
const commentableExtensions = new Set([".astro", ".cjs", ".css", ".html", ".js", ".md", ".mjs", ".mts", ".toml", ".ts", ".tsx", ".yaml", ".yml"]);
const contentLicense = "CC-BY-SA-4.0";
const softwareLicense = "Apache-2.0";

function listFiles(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? listFiles(path) : entry.isFile() ? [path] : [];
  });
}

function expectedLicense(path) {
  if (path.startsWith("data/") || path.startsWith("docs/") || path.startsWith("templates/")) return contentLicense;
  if (path.startsWith(".github/ISSUE_TEMPLATE/") || path === ".github/PULL_REQUEST_TEMPLATE.md") return contentLicense;
  if (["CONTRIBUTING.md", "README.md", "THIRD_PARTY_NOTICES.md", "plan.md"].includes(path)) return contentLicense;
  return softwareLicense;
}

function headerSearchLines(path) {
  return path === "plan.md" ? 120 : 8;
}

export function spdxHeaderErrors(root = projectRoot) {
  const repositoryRoot = resolve(root);
  const paths = new Set(rootFiles);
  for (const directory of scannedDirectories) {
    for (const absolutePath of listFiles(join(repositoryRoot, directory))) {
      const path = relative(repositoryRoot, absolutePath).split(sep).join("/");
      if (commentableExtensions.has(path.slice(path.lastIndexOf(".")).toLowerCase())) paths.add(path);
    }
  }

  return [...paths].sort().flatMap((path) => {
    const absolutePath = join(repositoryRoot, path);
    if (!existsSync(absolutePath)) return [`${path}: required SPDX source file is missing.`];
    const lines = readFileSync(absolutePath, "utf8").split(/\r?\n/).slice(0, headerSearchLines(path));
    const expected = `SPDX-License-Identifier: ${expectedLicense(path)}`;
    return lines.some((line) => line.includes(expected)) ? [] : [`${path}: missing ${expected} in the file header.`];
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const errors = spdxHeaderErrors();
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
  } else console.log("File-level SPDX headers match the software/content license policy.");
}

// SPDX-License-Identifier: Apache-2.0
import { readFileSync, statSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const packageJson = JSON.parse(read("package.json"));
const errors = [];

for (const path of [
  "LICENSE",
  "LICENSE-CONTENT",
  "THIRD_PARTY_NOTICES.md",
  ".github/workflows/ci.yml",
  ".github/workflows/pages.yml",
  "astro.config.mjs",
  "src/pages/index.astro",
]) {
  try {
    if (!statSync(new URL(`../${path}`, import.meta.url)).isFile()) errors.push(`Required file is not a file: ${path}`);
  } catch {
    errors.push(`Required file is missing: ${path}`);
  }
}

if (packageJson.license !== "Apache-2.0") errors.push("package.json must declare Apache-2.0.");
if (!read("LICENSE").startsWith("                                 Apache License")) errors.push("LICENSE must contain Apache License 2.0.");
if (!read("README.md").includes("Apache-2.0")) errors.push("README.md must identify the software license.");
if (!read("README.md").includes("CC BY-SA 4.0")) errors.push("README.md must identify the content license.");
if (/MIT|LICENSE-CODE/.test(read("README.md"))) errors.push("README.md contains a stale software-license reference.");

const codecrate = read(".codecrate.toml");
for (const extension of ["ts", "tsx", "css", "astro", "svg", "mjs", "cjs"]) {
  if (!codecrate.includes(`**/*.${extension}`)) errors.push(`.codecrate.toml is missing **/*.${extension}.`);
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log("Repository metadata and required project files are consistent.");
}

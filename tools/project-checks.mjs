// SPDX-License-Identifier: Apache-2.0
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parse } from "yaml";

export function relativeLinkErrors(markdown, file, root) {
  const errors = [];
  for (const match of markdown.matchAll(/\[[^\]]*\]\(([^\s)]+)(?:\s+"[^"]*")?\)/g)) {
    const target = match[1].replace(/^<|>$/g, "");
    if (/^(?:[a-z][a-z\d+.-]*:|#|\/\/)/i.test(target)) continue;
    const path = decodeURIComponent(target.split(/[?#]/)[0]);
    if (path && !existsSync(resolve(dirname(resolve(root, file)), path))) {
      errors.push(`${file}: unresolved local link "${target}".`);
    }
  }
  return errors;
}

export function fontNoticeErrors(fonts, notice) {
  return fonts.filter((font) => !notice.includes(`\`${font.id}\``))
    .map((font) => `THIRD_PARTY_NOTICES.md: missing font record "${font.id}".`);
}

export function projectContentErrors(root) {
  const read = (path) => readFileSync(resolve(root, path), "utf8");
  const errors = relativeLinkErrors(read("README.md"), "README.md", root);
  const fonts = readdirSync(resolve(root, "data/fonts")).filter((name) => name.endsWith(".yaml"))
    .map((name) => parse(read(`data/fonts/${name}`)));
  errors.push(...fontNoticeErrors(fonts, read("THIRD_PARTY_NOTICES.md")));
  const minimum = JSON.parse(read("package.json")).engines.node.replace(/^>=/, "");
  if (read(".node-version").trim() !== minimum) errors.push(".node-version must match the package.json Node minimum.");
  for (const name of readdirSync(resolve(root, ".github/workflows"))) {
    if (!/\.ya?ml$/.test(name)) continue;
    const workflow = parse(read(`.github/workflows/${name}`));
    for (const job of Object.values(workflow.jobs ?? {})) {
      for (const step of job.steps ?? []) {
        if (step.uses?.startsWith("actions/setup-node@") && step.with?.["node-version-file"] !== ".node-version") {
          errors.push(`.github/workflows/${name}: setup-node must use .node-version.`);
        }
      }
    }
  }
  return errors;
}

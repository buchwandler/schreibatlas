import assert from "node:assert/strict";
import { copyFileSync, cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { parse, stringify } from "yaml";
import { localizedGlyphPaths, localizedModelPaths, loadContent } from "../../tools/content.mjs";
import { draftGlyphRecord } from "./content.test-helper.mjs";

const projectRoot = fileURLToPath(new URL("../../", import.meta.url));

test("validated YAML drives localized model and Unicode glyph routes", (t) => {
  const temporary = mkdtempSync(join(tmpdir(), "schreibatlas-content-"));
  t.after(() => rmSync(temporary, { recursive: true, force: true }));
  const root = join(temporary, "project");
  cpSync(join(projectRoot, "schema"), join(root, "schema"), { recursive: true });
  cpSync(join(projectRoot, "data"), join(root, "data"), { recursive: true });
  copyFileSync(join(projectRoot, "package.json"), join(root, "package.json"));

  const modelPath = join(root, "data/models/demo-round/model.yaml");
  const model = parse(readFileSync(modelPath, "utf8"));
  model.name.de = "Geändertes Testmodell";
  model.character_repertoire = ["U+00DF"];
  writeFileSync(modelPath, stringify(model));
  const glyphDirectory = join(root, "data/glyphs/demo-round");
  mkdirSync(glyphDirectory, { recursive: true });
  writeFileSync(join(glyphDirectory, "00DF.yaml"), stringify(draftGlyphRecord({
    model: "demo-round",
    character: "ß",
    unicode: ["U+00DF"],
  })));

  const content = loadContent(root);
  assert.equal(content.models.find((entry) => entry.id === "demo-round").name.de, "Geändertes Testmodell");
  assert.deepEqual(localizedModelPaths(content.models).filter(({ id }) => id === "demo-round").map(({ lang, id }) => `${lang}/${id}`), [
    "de/demo-round",
    "en/demo-round",
  ]);
  assert.deepEqual(localizedGlyphPaths(content.glyphs).map(({ lang, id, slug }) => `${lang}/${id}/${slug}`), [
    "de/demo-round/u00df",
    "en/demo-round/u00df",
  ]);

  const glyphPath = join(glyphDirectory, "00DF.yaml");
  const glyph = parse(readFileSync(glyphPath, "utf8"));
  glyph.verification = "verified";
  writeFileSync(glyphPath, stringify(glyph));
  assert.throws(() => loadContent(root), /Cannot render invalid canonical data/);
});

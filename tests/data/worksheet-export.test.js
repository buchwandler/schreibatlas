// SPDX-License-Identifier: Apache-2.0
import assert from "node:assert/strict";
import test from "node:test";
import { inflateSync } from "node:zlib";
import { appendWorksheetMetadataToPng, createWorksheetPdf } from "../../tools/worksheet-export.mjs";

const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10];

function minimalPng() {
  const header = [0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0, 0, 0, 0, 0];
  const end = [0, 0, 0, 0, 73, 69, 78, 68, 0, 0, 0, 0];
  return new Uint8Array([...pngSignature, ...header, ...end]);
}

test("PNG export embeds the exact worksheet metadata in a text chunk", () => {
  const metadata = { worksheetId: "SAW1-1234ABCD", datasetVersion: "test-v1", outlines: [{ character: "a", sources: ["source-a"] }] };
  const png = appendWorksheetMetadataToPng(minimalPng(), metadata);
  const typeIndex = png.findIndex((byte, index) => byte === 116 && png[index + 1] === 69 && png[index + 2] === 88 && png[index + 3] === 116);
  assert.ok(typeIndex > 0);
  const length = new DataView(png.buffer, png.byteOffset + typeIndex - 4, 4).getUint32(0);
  const data = new TextDecoder().decode(png.subarray(typeIndex + 4, typeIndex + 4 + length));
  const [keyword, base64] = data.split("\0");
  assert.equal(keyword, "SchreibatlasWorksheet");
  assert.deepEqual(JSON.parse(atob(base64)), metadata);
});

test("PDF export is deterministic and carries the complete worksheet metadata", async () => {
  const metadata = {
    kind: "schreibatlas-worksheet",
    worksheetId: "SAW1-1234ABCD",
    fontId: "font-schulschriften-sas",
    fontIntegrity: { sha256: "artifact-hash", bytes: 1234 },
    fontUpstream: { kind: "archive", sha256: "source-hash" },
    fontDerivation: { recipe: "tools/fonts/schulschriften/build.py", unicode_mapping_sha256: "mapping-hash", tfm_sha256: "tfm-hash", provenance_file_url: "/data/v1/assets/fonts/font-schulschriften-sas/provenance/sas.json" },
    fontCorrespondence: { model: "de-sas", degree: "partial" },
    fontSources: ["src-ctan-schulschriften-v5"],
    fontSourceRecords: [{ id: "src-ctan-schulschriften-v5", title: "CTAN schulschriften v5", url: "https://ctan.org/pkg/schulschriften" }],
    fontFileUrl: "/data/v1/assets/fonts/font-schulschriften-sas/1-sas.ttf",
    fontLicenseFileUrl: "/data/v1/assets/fonts/font-schulschriften-sas/LPPL-1.3c-Schulschriften.txt",
    fontProvenanceUrl: "/data/v1/assets/fonts/font-schulschriften-sas/provenance/sas.json",
    fontLicenseText: "LPPL-1.3c", shaping: { required_features: ["calt", "kern"] },
    datasetVersion: "test-v1",
    settings: { model: "de-volksschrift", text: "blume" },
    outlines: [{ character: "b", sources: ["src-volksschrift-font"] }],
  };
  const input = { pageWidthMm: 210, pageHeightMm: 297, pixelWidth: 2, pixelHeight: 1, rgb: new Uint8Array([255, 255, 255, 0, 0, 0]), metadata };
  const first = await createWorksheetPdf(input);
  const second = await createWorksheetPdf(input);
  assert.deepEqual(first, second);
  const pdfBytes = Buffer.from(first);
  const pdf = pdfBytes.toString("latin1");
  assert.ok(pdf.startsWith("%PDF-1.7"));
  const imageHeader = pdf.match(/4 0 obj\n<< [^\n]*\/Length (\d+) >>\nstream\n/);
  assert.ok(imageHeader);
  const imageStart = (imageHeader.index ?? 0) + imageHeader[0].length;
  assert.deepEqual(inflateSync(first.subarray(imageStart, imageStart + Number(imageHeader[1]))), Buffer.from(input.rgb));
  const xrefOffset = Number(pdf.match(/startxref\n(\d+)/)?.[1]);
  assert.equal(pdfBytes.subarray(xrefOffset, xrefOffset + 5).toString("latin1"), "xref\n");
  const xrefLines = pdfBytes.subarray(xrefOffset).toString("latin1").split("\n");
  for (let number = 1; number <= 7; number += 1) {
    const objectOffset = Number(xrefLines[number + 2].slice(0, 10));
    assert.equal(pdfBytes.subarray(objectOffset, objectOffset + `${number} 0 obj`.length).toString("latin1"), `${number} 0 obj`);
  }
  assert.ok(pdf.includes("/MediaBox [0 0 595.276 841.89]"));
  assert.ok(pdf.includes("/Subject (SAW1-1234ABCD)"));
  const encoded = pdf.match(/<sa:metadata encoding="base64">([^<]+)<\/sa:metadata>/)?.[1];
  assert.ok(encoded);
  assert.deepEqual(JSON.parse(Buffer.from(encoded, "base64").toString("utf8")), metadata);
});

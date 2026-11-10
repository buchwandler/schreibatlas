// SPDX-License-Identifier: Apache-2.0
export const worksheetPapers = {
  A4: { width: 210, height: 297 },
  Letter: { width: 215.9, height: 279.4 },
};

export const worksheetDefaults = {
  paper: "A4",
  marginMm: 12,
  rowHeightMm: 18,
  guides: "baseline-xheight",
  text: "",
  referenceRow: true,
  tracingRows: 2,
  blankRows: 2,
  repetitions: 1,
  referenceKind: "vector",
};

export const worksheetPresets = [
  { id: "volksschrift-blume", model: "de-volksschrift", text: "blume" },
  { id: "volksschrift-lesen", model: "de-volksschrift", text: "lesen" },
  { id: "volksschrift-sonne", model: "de-volksschrift", text: "sonne" },
  { id: "volksschrift-limo", model: "de-volksschrift", text: "limo" },
];


export const worksheetMarker = {
  format: "schreibatlas-fiducial",
  version: 1,
  sizeMm: 8,
  insetMm: 3,
  moduleCount: 2,
};

export function worksheetMarkerLayout(width, height) {
  const center = worksheetMarker.insetMm + worksheetMarker.sizeMm / 2;
  return [
    { code: 1, corner: "top-left", x: center, y: center },
    { code: 2, corner: "top-right", x: width - center, y: center },
    { code: 3, corner: "bottom-right", x: width - center, y: height - center },
    { code: 4, corner: "bottom-left", x: center, y: height - center },
  ];
}

export function worksheetId(settings, datasetVersion) {
  const identity = `${datasetVersion}\n${JSON.stringify(settings)}`;
  let hash = 0x811c9dc5;
  for (let index = 0; index < identity.length; index += 1) {
    hash ^= identity.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `SAW1-${(hash >>> 0).toString(16).padStart(8, "0").toUpperCase()}`;
}
const allowedMargins = new Set([8, 12, 16]);
const allowedRowHeights = new Set([16, 18, 20]);
const allowedGuides = new Set(["none", "baseline", "baseline-xheight"]);
const allowedTracingRows = new Set([0, 1, 2]);
const allowedBlankRows = new Set([1, 2]);
const allowedRepetitions = new Set([1, 2]);

export function normalizeWorksheetSettings(value, modelIds = [], fallbackModel = "") {
  const source = value && typeof value === "object" ? value : {};
  const requestedModel = typeof source.model === "string" ? source.model : "";
  const model = modelIds.includes(requestedModel) ? requestedModel : modelIds[0] ?? fallbackModel;
  const text = typeof source.text === "string"
    ? [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(source.text)].slice(0, 24).map((segment) => segment.segment).join("")
    : worksheetDefaults.text;
  return {
    version: 1,
    model,
    paper: source.paper === "Letter" ? "Letter" : worksheetDefaults.paper,
    marginMm: allowedMargins.has(source.marginMm) ? source.marginMm : worksheetDefaults.marginMm,
    rowHeightMm: allowedRowHeights.has(source.rowHeightMm) ? source.rowHeightMm : worksheetDefaults.rowHeightMm,
    guides: allowedGuides.has(source.guides) ? source.guides : worksheetDefaults.guides,
    text,
    referenceRow: typeof source.referenceRow === "boolean" ? source.referenceRow : worksheetDefaults.referenceRow,
    tracingRows: allowedTracingRows.has(source.tracingRows) ? source.tracingRows : worksheetDefaults.tracingRows,
    blankRows: allowedBlankRows.has(source.blankRows) ? source.blankRows : worksheetDefaults.blankRows,
    repetitions: allowedRepetitions.has(source.repetitions) ? source.repetitions : worksheetDefaults.repetitions,
    referenceKind: source.referenceKind === "font" ? "font" : "vector",
  };
}

export function encodeWorksheetSettings(settings) {
  const bytes = new TextEncoder().encode(JSON.stringify(settings));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const encoded = btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
  return `#worksheet=${encoded}`;
}

export function decodeWorksheetSettings(fragment, modelIds = [], fallbackModel = "") {
  const match = /^#worksheet=([A-Za-z0-9_-]+)$/.exec(fragment);
  if (!match || match[1].length > 2048) return null;
  try {
    const base64 = match[1].replaceAll("-", "+").replaceAll("_", "/");
    const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const value = JSON.parse(new TextDecoder().decode(bytes));
    if (!value || value.version !== 1) return null;
    return normalizeWorksheetSettings(value, modelIds, fallbackModel);
  } catch {
    return null;
  }
}

export function layoutWorksheet(settings) {
  const paper = worksheetPapers[settings.paper];
  const headerHeight = 18;
  const rows = [];
  for (let repetition = 1; repetition <= settings.repetitions; repetition += 1) {
    if (settings.referenceRow) rows.push({ kind: "reference", repetition, number: 1 });
    for (let number = 1; number <= settings.tracingRows; number += 1) rows.push({ kind: "trace", repetition, number });
    for (let number = 1; number <= settings.blankRows; number += 1) rows.push({ kind: "blank", repetition, number });
  }

  const firstRowY = settings.marginMm + headerHeight;
  const rowCapacity = Math.floor((paper.height - settings.marginMm * 2 - headerHeight) / settings.rowHeightMm);
  if (rows.length > rowCapacity) throw new Error("Worksheet settings exceed the selected page height.");
  return {
    width: paper.width,
    height: paper.height,
    headerHeight,
    firstRowY,
    rowCapacity,
    rows: rows.map((row, index) => {
      const top = firstRowY + index * settings.rowHeightMm;
      const baseline = top + settings.rowHeightMm * 0.72;
      return {
        ...row,
        top,
        baseline,
        xHeight: baseline - settings.rowHeightMm * 0.4,
      };
    }),
  };
}

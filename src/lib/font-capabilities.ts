// SPDX-License-Identifier: Apache-2.0
import type { FontExport, FontRecord } from "../../tools/content.mjs";

export interface FontProvenanceRow {
  label: string;
  value: string;
  href?: string;
}

export type FontCapability = "both" | "vector" | "font" | "none";

export function fontCapability(hasVector: boolean, hasFont: boolean): FontCapability {
  return hasVector && hasFont ? "both" : hasVector ? "vector" : hasFont ? "font" : "none";
}

export interface FontProvenanceInfo {
  title: string;
  rows: FontProvenanceRow[];
  pipeline: string[];
  provenanceUrl: string | null;
}

export function fontSupportsText(font: Pick<FontExport, "supported_characters">, text: string): boolean {
  const supported = new Set(font.supported_characters);
  return [...text].every((character) => /[\r\n\t]/u.test(character) || supported.has(character));
}

export function requiredFeatureSettings(features: readonly string[] | undefined): string {
  return (features ?? []).map((feature) => `"${feature}" 1`).join(", ");
}

export function fontFeatureSettings(font: Pick<FontRecord, "shaping">): string {
  return requiredFeatureSettings(font.shaping?.required_features);
}

export function supportsRequiredFontFeatures(font: Pick<FontRecord, "shaping">): boolean {
  const settings = fontFeatureSettings(font);
  return !settings || CSS.supports("font-feature-settings", settings);
}

export function fontProvenanceInfo(font: FontRecord, lang: "de" | "en", provenanceUrl?: string): FontProvenanceInfo {
  const de = lang === "de";
  const rows: FontProvenanceRow[] = [];
  const features = font.shaping?.required_features ?? [];
  rows.push({
    label: de ? "Erforderliche OpenType-Funktionen" : "Required OpenType features",
    value: features.length ? features.join(", ") : (de ? "Nicht dokumentiert" : "Not documented"),
  });
  const upstream = font.upstream;
  if (upstream && "archive_url" in upstream) {
    rows.push({
      label: de ? "Quellarchiv" : "Source archive",
      value: `${upstream.package} ${upstream.version} · SHA-256 ${upstream.sha256}`,
      href: upstream.archive_url,
    });
    rows.push({ label: de ? "Quell-METAFONT" : "Source METAFONT", value: upstream.source_file });
  } else if (upstream) {
    rows.push({
      label: de ? "Upstream-Quelle" : "Upstream source",
      value: `${upstream.release} · ${upstream.commit}`,
      href: upstream.repository,
    });
    rows.push({ label: de ? "Quelldatei" : "Source file", value: upstream.source_file });
  }
  if (font.derivation) {
    rows.push({ label: de ? "Konvertierungsrezept" : "Conversion recipe", value: font.derivation.recipe });
    rows.push({
      label: de ? "Unicode-Zuordnung" : "Unicode mapping",
      value: `${font.derivation.unicode_mapping} · SHA-256 ${font.derivation.unicode_mapping_sha256}`,
    });
    rows.push({ label: "TFM", value: `${font.derivation.tfm_file} · SHA-256 ${font.derivation.tfm_sha256}` });
    rows.push({ label: de ? "Ableitungshinweis" : "Derivation note", value: font.derivation.notes });
  }
  if (font.integrity) {
    rows.push({
      label: de ? "SHA-256 der Browserfontdatei" : "Browser font file SHA-256",
      value: `${font.integrity.sha256} · ${font.integrity.bytes} bytes`,
    });
  }
  return {
    title: de ? "Formung und Ableitungsnachweis" : "Shaping and derivation provenance",
    rows,
    pipeline: font.derivation?.pipeline ?? [],
    provenanceUrl: provenanceUrl ?? font.derivation?.provenance_file_url ?? null,
  };
}

export function appendFontProvenance(parent: HTMLElement, font: FontRecord, lang: "de" | "en", provenanceUrl?: string): void {
  const info = fontProvenanceInfo(font, lang, provenanceUrl);
  const details = document.createElement("details");
  details.className = "font-provenance";
  const summary = document.createElement("summary");
  summary.textContent = info.title;
  details.append(summary);
  const list = document.createElement("dl");
  list.className = "metadata-list";
  for (const row of info.rows) {
    const term = document.createElement("dt");
    term.textContent = row.label;
    const value = document.createElement("dd");
    if (row.href) {
      const link = document.createElement("a");
      link.href = row.href;
      if (row.href.startsWith("https://")) {
        link.target = "_blank";
        link.rel = "noopener noreferrer";
      }
      link.textContent = row.value;
      value.append(link);
    } else value.textContent = row.value;
    list.append(term, value);
  }
  details.append(list);
  if (info.pipeline.length) {
    const heading = document.createElement("h4");
    heading.textContent = lang === "de" ? "Konvertierungsschritte" : "Conversion pipeline";
    const pipeline = document.createElement("ol");
    for (const step of info.pipeline) {
      const item = document.createElement("li");
      item.textContent = step;
      pipeline.append(item);
    }
    details.append(heading, pipeline);
  }
  if (info.provenanceUrl) {
    const link = document.createElement("a");
    link.href = info.provenanceUrl;
    link.textContent = lang === "de" ? "Vollständigen Ableitungsbericht öffnen" : "Open full derivation report";
    details.append(link);
  }
  parent.append(details);
}

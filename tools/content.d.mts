// SPDX-License-Identifier: Apache-2.0
export type Locale = "de" | "en";
export type VerificationStatus = "draft" | "inferred" | "source-backed" | "reviewed" | "verified" | "deprecated";
export type LocalizedText = Record<string, string>;

export interface Metrics {
  baseline: number | null;
  x_height: number | null;
  cap_height?: number | null;
  ascender: number | null;
  descender: number | null;
  nominal_slant?: number | null;
}

export interface CountryRecord {
  id: string;
  name: LocalizedText;
  languages: string[];
}

export interface LanguageRecord {
  id: string;
  name: LocalizedText;
  script: string;
  direction: string;
}

export interface RepertoireScope {
  entries: string[];
  complete: boolean;
  sources: string[];
}

export interface ModelExample {
  text: string;
  language: string;
  sources: string[];
}
export interface ModelRecord {
  id: string;
  name: LocalizedText;
  aliases?: Record<string, string[]>;
  regions?: string[];
  family?: string;
  education?: { level?: ("primary" | "secondary" | "adult")[]; role?: ("initial-script" | "connected-script" | "development-script")[]; notes?: LocalizedText };
  characteristics?: { uppercase?: LocalizedText; lowercase?: LocalizedText; connections?: LocalizedText };
  examples?: { words?: ModelExample[]; sentences?: ModelExample[] };
  repertoire?: Partial<Record<"teaching_core" | "numerals" | "punctuation" | "special_characters", RepertoireScope>>;
  country: string | null;
  languages: string[];
  classification: { joined: boolean | null; slant: { kind: string; nominal_degrees: number | null } | null } | null;
  period: { from: number | null; to: number | null; precision?: "year" | "decade" | "approximate" | "unknown"; notes?: LocalizedText } | null;
  status: { use: string; verification: VerificationStatus };
  character_repertoire: string[];
  character_repertoire_complete: boolean;
  metrics: Metrics | null;
  reference_fonts: string[];
  sources: string[];
  license: string;
  demo: boolean;
  description?: LocalizedText;
  educational_context?: LocalizedText;
}

export interface GlyphOutline {
  path: string;
  view_box: [number, number, number, number];
  baseline: number;
  x_height: number;
  fill_rule?: "nonzero" | "evenodd";
}

export interface GlyphVariant {
  id: string;
  label: LocalizedText;
  outline?: GlyphOutline | null;
  status: VerificationStatus;
  sources: string[];
}

export interface GlyphDerivation {
  kind: "source-traced" | "font-derived" | "project-reconstructed" | "project-authored" | "unknown";
  source_font?: string;
  source_glyph?: string;
  process: string;
  verification: VerificationStatus;
  represents: string[];
  does_not_establish: string[];
}
export interface GlyphRecord {
  model: string;
  character: string;
  unicode: string[];
  forms: { isolated: { status: VerificationStatus }; contextual: { context: string; status: VerificationStatus; outline?: GlyphOutline | null }[] };
  metrics: Metrics;
  outline?: GlyphOutline | null;
  reference: { font: string | null; glyph_name: string | null };
  connections: { entry: { present: boolean | null }; exit: { present: boolean | null } };
  variants: (string | GlyphVariant)[];
  derivation?: GlyphDerivation;
  notes?: LocalizedText;
  related_characters?: string[];
  source_claims?: { field: string; sources: string[]; notes: LocalizedText }[];
  sources: string[];
  verification: VerificationStatus;
  license: string;
}

export interface SourceRecord {
  id: string;
  kind: string;
  title: string;
  author: string[];
  publisher: string | null;
  year: number | null;
  locator: { pages?: number[]; figure?: string | null; section?: string | null; table?: string | null; anchor?: string | null; quote_anchor?: string | null } | null;
  retrieved?: string;
  edition?: string | null;
  isbn?: string | null;
  doi?: string | null;
  archive_url?: string | null;
  url: string | null;
  rights: { type: string; license: string | null };
  notes: string | null;
}

export interface FontRecord {
  id: string;
  name: string;
  author: string;
  project_url: string | null;
  license: string;
  files: string[];
  license_file?: string | null;
  license_file_url?: string | null;
  font_version?: string;
  format?: "truetype" | "opentype" | "woff" | "woff2";
  weight?: number;
  style?: "normal" | "italic" | "oblique";
  family_name?: string;
  postscript_name?: string;
  upstream?: { repository: string; release: string; commit: string; source_file: string };
  integrity?: { sha256: string; bytes: number };
  shaping?: { required_features: string[]; language_tag: string; direction: "ltr" | "rtl" };
  calibration?: { x_height_em: number; x_height_method?: string; ascender_em?: number | null; descender_em?: number | null } | null;
  file_urls?: string[];
  correspondence: { model: string | null; degree: "complete" | "partial" | "visual-only" | "unknown"; notes: string | null; scope?: string[]; excludes?: string[]; sources?: string[] };
  sources: string[];
}

export interface StrokeRecord {
  model: string;
  character: string;
  verification: VerificationStatus;
  strokes: { order: number; file: string; pen_down: boolean; start: number[]; end: number[]; direction?: string | null; timing_ms?: number | null; file_url?: string }[];
  sources: string[];
  license: string;
}

export interface ConnectionRecord {
  model: string;
  left: string;
  right: string;
  status: VerificationStatus;
  behavior: { joins: boolean | null; left_variant: string | null; right_variant: string | null };
  reference: { font: string | null; shaped_text: string };
  sources: string[];
  license: string;
  notes?: LocalizedText;
}
export interface Content {
  countries: CountryRecord[];
  languages: LanguageRecord[];
  models: ModelRecord[];
  glyphs: GlyphRecord[];
  sources: SourceRecord[];
  fonts: FontRecord[];
  strokes: StrokeRecord[];
  connections: ConnectionRecord[];
}

export const locales: Locale[];
export function loadContent(root?: string): Content;
export function localizedModelPaths(models: ModelRecord[]): { lang: Locale; id: string; model: ModelRecord }[];
export function localizedGlyphPaths(glyphs: GlyphRecord[]): { lang: Locale; id: string; slug: string; glyph: GlyphRecord }[];
export function repertoireCharacters(model: ModelRecord): string[];
export function localizedLetterPaths(models: ModelRecord[], glyphs: GlyphRecord[]): { lang: Locale; id: string; slug: string; character: string; model: ModelRecord; glyph?: GlyphRecord }[];

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

export interface ModelRecord {
  id: string;
  name: LocalizedText;
  country: string | null;
  languages: string[];
  classification: { joined: boolean | null; slant: { kind: string; nominal_degrees: number | null } | null } | null;
  period: { from: number | null; to: number | null } | null;
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

export interface GlyphRecord {
  model: string;
  character: string;
  unicode: string[];
  forms: { isolated: { status: VerificationStatus }; contextual: { context: string; status: VerificationStatus }[] };
  metrics: Metrics;
  outline?: GlyphOutline | null;
  reference: { font: string | null; glyph_name: string | null };
  connections: { entry: { present: boolean | null }; exit: { present: boolean | null } };
  variants: string[];
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
  locator: { pages?: number[] } | null;
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
  calibration?: { x_height_em: number; ascender_em?: number | null; descender_em?: number | null } | null;
  file_urls?: string[];
  correspondence: { model: string | null; degree: "complete" | "partial" | "visual-only" | "unknown"; notes: string | null };
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

export interface Content {
  countries: CountryRecord[];
  languages: LanguageRecord[];
  models: ModelRecord[];
  glyphs: GlyphRecord[];
  sources: SourceRecord[];
  fonts: FontRecord[];
  strokes: StrokeRecord[];
}

export const locales: Locale[];
export function loadContent(root?: string): Content;
export function localizedModelPaths(models: ModelRecord[]): { lang: Locale; id: string; model: ModelRecord }[];
export function localizedGlyphPaths(glyphs: GlyphRecord[]): { lang: Locale; id: string; slug: string; glyph: GlyphRecord }[];

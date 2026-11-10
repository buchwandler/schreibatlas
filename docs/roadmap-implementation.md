<!-- SPDX-License-Identifier: CC-BY-SA-4.0 -->
# Roadmap implementation evidence

Task: task-0003. Source: [01_todo.md](../01_todo.md). This matrix tracks implementation, not approval or dataset release. An existing feature is not evidence that new roadmap acceptance criteria pass.

## Baseline reconciliation

The checked-in baseline has five models, two fonts, seven sources and eleven glyph records. The modern German models, Playwrite assets, connection record collection, and FontGlyphPreview component are absent. The previous completed Taskledger task does not establish that this version of the roadmap was implemented.

| Roadmap sections | Required work | Existing evidence / remaining gap | Checklist |
| --- | --- | --- | --- |
| 1–4 | Preserve static, bilingual, provenance-first foundations | `astro.config.mjs`, `src/lib/i18n.ts`, `tools/build-data.mjs`, `public/sw.js`; corpus gaps remain | 1, 11 |
| 5.1, 8.3 | Derivation taxonomy, field-specific evidence, structured variants, related characters | `schema/glyph.schema.json` currently lacks these fields | 2 |
| 5.2, 8.1 | Scoped teaching-core/numeral/punctuation repertoire and completeness | `schema/model.schema.json` has only unscoped inventory and boolean | 2 |
| 5.3, 5.5–5.6, 6 | Scoped font correspondence, reproducible supply chain, shaping metadata and integrity | `schema/font.schema.json` has calibration and basic correspondence; four pinned German fonts absent | 2, 3 |
| 5.4, 8.5 | Rich source kinds, locators, retrieval and bibliographic metadata | `schema/source.schema.json` only supports publication/placeholder and pages | 2 |
| 5.7–5.8, 14.1–14.2 | Uniform confidence/method objects, versioned reports, body-height and local slant | `tools/photo-analysis.mjs`, `tools/photo-reference.mjs`; no standardized v2 report | 7 |
| 5.9, 19.3 | Chromium reference shaping and Firefox/WebKit semantic compatibility | `src/lib/text-shaper.ts`, `tests/e2e/`; expanded fixtures and policy needed | 5, 11 |
| 5.10 | Schema evolution history and public-release boundary | `docs/dataset-releases.md`; schema history absent | 2 |
| 6.1–6.5, 7 | Four local Regular 400 Playwrite fonts, independent educational evidence, German model records | `data/fonts/`, `data/models/` contain only historical/demo baseline | 3 |
| 8.1 | Aliases, regions, education, characteristics, examples, uncertain periods | `schema/model.schema.json`, `templates/model.yaml` need extension | 2 |
| 8.2–8.5 | Schemas, API types, templates and cross-record semantics | `tools/content.d.mts`, `tools/validate-data.mjs` need matching changes | 2 |
| 8.4, 21 P2 | Optional sourced pair/sequence connections and contextual forms | Glyph entry/exit and contextual outline infrastructure exists; pair records absent | 2, 3, 9 |
| 9.1–9.2 | Source-first letter rendering, labeled font preview, repertoire routes without fake glyphs | `src/pages/[lang]/models/[id]/letters/` routes use glyph records only | 4 |
| 10.1 | Period, slant, educational role, region, family filters | `src/pages/[lang]/explore/index.astro` has basic filters only | 4 |
| 10.2 | Rich model metadata and multi-dimensional completeness | `src/pages/[lang]/models/[id]/index.astro` needs additional sections/counts | 4 |
| 11.1 | 2–6 models, grid/strip, overlay maximum 3, filters, case switch, share state | `src/scripts/letter-comparison.ts` is two-model comparison | 5 |
| 11.2 | Feature/version provenance, shaping warnings, preferred/alternative font selection | `src/components/TextComparisonPage.astro`, `src/scripts/word-comparison.ts` need extension | 5 |
| 12 | Font/vector worksheet modes, local shaping, calibration and SVG/PNG/PDF metadata | `src/scripts/worksheet.ts`, `tools/worksheet*.mjs` have vector export infrastructure | 6 |
| 13, 20 PR9 | Lawful source-backed movement subset with human path review | `schema/stroke.schema.json`, `src/components/StrokeRenderer.astro`, `tools/stroke-comparison.mjs` exist; no production references | 9 |
| 14.3–14.6, 20 PR8 | Supported width/spacing, repeated shapes, contour distance, connected-script refusal | `tools/worksheet-analysis.mjs` has isolated-shape clustering and constrained fitting; general unjoined alignment absent | 7 |
| 15 | Overlay toggles, opacity, accessible metric cards and unavailable reasons | `src/pages/[lang]/analyze/index.astro`, `src/scripts/photo-analysis.ts` need controls | 8 |
| 16 | Locally recognized non-sensitive worksheet identity | `tools/worksheet.mjs` has IDs/fiducials; `detectWorksheetGeometry` requires supplied metadata | 8 |
| 17, 20 PR10, 21 P4 | Bounded 2–3-country pilot, independent evidence, local fonts and English discovery | Only DE/de data currently present | 10 |
| 18.1 | Restore roadmap target and validate local README links | User-provided `01_todo.md` exists but is untracked; README's claim of an end-of-file current summary is stale | 2 |
| 18.2 | Correct third-party notices and enforce font coverage | `THIRD_PARTY_NOTICES.md` incorrectly says no bundled assets | 2 |
| 18.3 | Node minimum consistency | `package.json` declares >=22.23.4; add local version file and enforce CI consistency | 2 |
| 19.1–19.2 | Schema/data/font/repertoire/integrity/connection/completeness tests | Extend `tests/data/` | 2–4, 11 |
| 19.4 | Keyboard N-way comparison, font provenance alternatives, analysis controls, canvas equivalents, reduced motion | Extend `tests/e2e/` | 4–5, 8–9, 11 |
| 19.5 | Positive/boundary/refusal analysis fixtures including geometry and low contrast | Extend `tests/data/photo-analysis.test.js`, `photo-reference.test.js`, `worksheet-analysis.test.js` | 7, 11 |
| 20–24 | Preserve dependency order and German Reference Set milestone gates | Eleven implementation todos follow prescribed order; segmentation and worksheet identity included explicitly | all |
| 22, 25–26 | No invented evidence, stroke inference, remote fonts, OCR, cloud processing or quality scores | Enforce throughout data, UI, exports and tests; source candidates require verification | all |

## External gates

- A movement teaching source must permit the intended asset use. Public access alone is insufficient.
- Human movement-path review must be supplied by a human, not inferred from automated tests or performed under a false user identity.
- Dataset publication is not part of this implementation task.

## Progress

- Baseline reconciliation complete. Implementation and verification evidence will be added as each checklist item is completed.
- No new corpus, analysis, movement or international requirement is claimed complete by this initial matrix.
- Repository hygiene implemented: README target restored, current font notices corrected, local-link/font-notice consistency tests added, and all setup-node workflows share `.node-version` (22.23.4).
- Evidence foundation implemented: rich model/source/font/glyph schemas, derivation checks, structured variants, scoped inventory validation, connection schema/loading/export, API types, templates and contributor/review guidance. Existing canonical records still validate without invented provenance.
- Checks: typecheck (check-0004), validation (check-0005), baseline unit suite (check-0006), six new evidence tests (check-0007), and static build (check-0008) passed. Browser check-0009 could not launch the downloaded Chromium because system libraries were missing. Explicit system Chromium via `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` passed all 24 browser tests (check-0010). This override is optional; default CI behavior is unchanged.
- German corpus implemented: four independently documented modern models and four pinned Regular 400 Playwrite v1.003 fonts. Font integrity, internal identity/version, declared character coverage, required features and calibration are checked. Educational inventory completeness remains false; source-traced and movement coverage is not invented.
- Repertoire browsing implemented: 873 bilingual pages, labeled local-font previews, font-load refusal, model completeness dimensions and added discovery filters. Check-0026 passed all 30 browser tests, including offline reload and bilingual Axe audits.
- Comparison implemented: an additional 2–6-model comparison with grid/strip, maximum-three overlay, case controls, country/language/joined filters and shareable model sets. The existing two-outline comparator remains available. Word/sentence provenance includes font version and explicit OpenType features. Check-0030 covers all four German models and fixture strings.
- Font-backed worksheets implemented: explicit vector/font modes, calibrated local shaping, embedded font bytes and complete OFL text in SVG, font provenance in SVG/PNG/PDF metadata, unsupported-character refusal and preserved vector behavior. Check-0034 passed 33 browser tests; check-0036 verifies actual SVG/PNG/PDF downloads. Check-0037 covers representation round-trip/identity and bounded offline caching.
- Still open: analysis metrics v2 and segmentation diagnostics; analysis controls and autonomous worksheet identity recognition; lawful movement pilot with human review; bounded international pilot; full final acceptance validation and compatibility-engine runs. These requirements are not marked complete.
- Current checkpoint: check-0038 typecheck, check-0039 validation, check-0040 all 116 unit tests, check-0041 static build and check-0042 all 34 Chromium browser tests pass. Task remains in implementation at 6/11 todos, with todo-0007 next; no final Taskledger acceptance validation has been recorded.

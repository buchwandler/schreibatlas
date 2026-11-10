<!-- SPDX-License-Identifier: CC-BY-SA-4.0 -->
# Data contribution guide

## Evidence and source records

Create a source record for each work, source page, or font project that supports a model, glyph, contextual form, font, or license claim. Record the author, title, publication date when known, publisher, stable URL or precise locator, and rights. Distinguish citation rights from permission to redistribute a scan, font, or vector asset.

A source must support the specific claim. A source that describes a script generally does not establish every letter shape, a complete repertoire, or pen movement. State page or figure references when available. Record uncertainty rather than fill gaps by inference.

## Verification states

- `draft`: incomplete or awaiting evidence. This is the correct state for unverified submissions.
- `inferred`: a stated interpretation, not a directly sourced observation.
- `source-backed`: the cited source supports the recorded claim.
- `reviewed`: a second review checked the source and transcription.
- `verified`: use only when the project's stricter verification evidence is satisfied.
- `deprecated`: retained for traceability but no longer recommended.

The validator checks references and required evidence, but a schema-valid record is not automatically historically correct. Review the source itself.

## Models, glyphs, and contextual forms

Use `templates/model.yaml`, `templates/glyph.yaml`, and `templates/source.yaml` as starting points. Replace example identifiers and placeholder values before submitting.

A final-form vector outline is not stroke-order evidence. Do not derive movement, direction, pen lifts, or timing from an outline or font. Add a contextual outline only when the source documents that contextual form and the glyph record cites that source. Leave the contextual outline absent when only the context is known.

Record repertoire completeness only when a source supports the exact declared scope. Keep the model's period, locale, author, and regional limits explicit. Digital fonts may be partial, modern adaptations, or visual-only aids; represent those limits in the font correspondence fields.

## Structured evidence fields

Use `repertoire.teaching_core`, `numerals`, `punctuation`, and `special_characters` for explicitly sourced inventories. Each scope declares `entries`, `complete`, and `sources`. Scope completeness is an educational inventory claim, not font coverage, traced-outline coverage, or movement coverage. Keep the legacy flat inventory as the union of declared entries; the validator checks scoped entries against it.

Model aliases are locale-keyed string arrays. Regions use country-prefixed ISO subdivision identifiers. Educational roles, characteristics, period uncertainty and examples must remain supported by citations. Project-original example text needs its own project-original source rather than being attributed to an educational publication.

Set glyph `derivation.kind` to `source-traced`, `font-derived`, `project-reconstructed`, `project-authored`, or `unknown`, with the actual process, verification and representation limits. Font-derived data requires `source_font`, `source_glyph`, and an explicit `official-stroke-order` exclusion. Use `source_claims` to attach sources to individual fields. New variants should be objects containing `id`, localized `label`, optional `outline`, `status`, and `sources`; legacy string variants remain supported for migration only.

Connection records use `templates/connection.yaml` and live under `data/connections/<model>/`. Cite pair/sequence evidence, use only the model's reference fonts, and resolve variant IDs to structured glyph variants. Start with a small documented subset, not a full connection matrix.

For web sources, record a quoted `retrieved` date in YYYY-MM-DD form. Locators can identify pages, figures, sections, tables and anchors. Record edition, ISBN, DOI or archive URL when known. These fields do not grant redistribution rights.

New pinned font records include the full upstream commit, release, source path, internal version, family/PostScript identity, format/weight/style, single-asset SHA-256 and byte count, measured calibration and required shaping features. Document correspondence scope and exclusions separately from model identity. Include the font record ID in `THIRD_PARTY_NOTICES.md`. Do not retrofit invented upstream metadata onto older fonts.

See [schema history and release policy](data-schema-history.md).

## Licensing and assets

Retain the asset's original license. Record the license identifier and include the required license text and attribution. Do not assume that a publicly viewable image or a source URL grants redistribution rights. Do not add third-party fonts or scans to the repository until the license and attribution requirements have been checked.

Original project-authored content uses CC BY-SA 4.0. Project software uses Apache-2.0. Third-party assets remain under their own recorded licenses.
Every comment-capable project source and data file carries an SPDX identifier. `npm run validate` enforces the software/content policy. JSON has no comment syntax and is excluded from header checks; its license is identified through the repository license files and schema or manifest metadata.

## Validation and review

Before opening a pull request, run `npm run validate` and the checks in `CONTRIBUTING.md`. Include source citations and license evidence in the pull request. Reviewers should apply every item in `provenance-review-checklist.md`, inspect generated pages, and check that low-confidence or unavailable data remains visibly qualified.

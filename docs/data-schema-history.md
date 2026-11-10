<!-- SPDX-License-Identifier: CC-BY-SA-4.0 -->
# Data schema history

## Unreleased v1 evidence foundation

No public dataset release has been published. Before the first stable release, `/data/v1/` may evolve, but schemas, canonical records, TypeScript declarations, exports, validation, tests and documentation must change together. Existing records remain valid; absent evidence is not synthesized during migration.

Added optional model aliases, regions, family, educational roles, characteristics, sourced examples, period uncertainty and scoped repertoires. A scope's `complete` means its declared educational inventory is complete according to cited sources, not that traced outlines or verified movement exist. The legacy `character_repertoire_complete` retains its stricter requirement that all declared characters have glyph records. Font coverage cannot establish educational completeness.

Added optional glyph derivation, localized notes, related characters, field-specific source claims and structured variants. Legacy string variants remain readable; new evidence-bearing variants use IDs, localized labels, verification status and sources. Font-derived representations must explicitly exclude official stroke order.

Added source kinds, rich locators, retrieval dates and bibliographic fields; source rights remain independent from citation metadata. Added font supply-chain, single-asset integrity, font identity, shaping and scoped correspondence fields. Existing historical fonts without proven upstream pins are not assigned invented release or commit values.

Added optional connection records in `data/connections/<model>/`, loaded into content and exported as `/data/v1/connections.json`. Connections describe sourced pair/sequence behavior, not movement. Their fonts must belong to their model, and variant IDs must resolve to structured glyph variants.

## First public release boundary

Once the first public dataset release is published, freeze v1 semantics. Breaking changes after that require `/data/v2/`. Preserve the old exports and document migration steps rather than silently changing the meaning of published fields.

## Browser reproducibility

Chromium is the required reference shaping engine. Firefox and WebKit are compatibility engines. Test selected fixture strings for font loading, feature activation and semantic geometry. Exact raster equivalence across engines or platforms is not required.

<!-- SPDX-License-Identifier: CC-BY-SA-4.0 -->
# Provenance and claim review checklist

Reviewers should check the applicable items before approving a data or product change.

## Evidence and scope

- [ ] Each substantive historical or model claim cites a source that supports that exact claim.
- [ ] The source record identifies author, title, date/publisher when known, URL or locator, and rights.
- [ ] Model period, locale, author, and declared repertoire match the source's scope.
- [ ] Glyph and contextual-form outlines are traceable to sources. Font-derived shapes are labeled as font data, not transcriptions of a historical specimen.
- [ ] Missing evidence remains unknown, draft, or unavailable. No movement or stroke order is inferred from final outlines or fonts.

## Licensing

- [ ] Redistribution rights for each new font, image, scan, and vector asset were checked separately from citation rights.
- [ ] Original license text and attribution are preserved where required.
- [ ] Project-authored code and content use the repository's documented licenses.
- [ ] No user-selected photo, report, or captured writing is committed, uploaded, or added to the static precache.

## Interface and measurements

- [ ] The UI identifies the source and license and exposes correspondence limits.
- [ ] Empty states do not substitute system-font or guessed handwriting shapes.
- [ ] Measurements use bounded geometry and disclose their method and confidence.
- [ ] Low-confidence or ambiguous measurements are withheld.
- [ ] The change adds no overall handwriting-quality score or unsupported authorship claim.
- [ ] New routes and controls remain keyboard accessible and pass the automated Axe audit.

## Verification

- [ ] `npm run validate`, `npm test`, `npm run typecheck`, and `npm run build` pass where relevant.
- [ ] Playwright tests cover changed user-visible behavior.
- [ ] Generated bilingual pages, exports, and visual-preview artifacts were inspected.

# SPDX-License-Identifier: CC-BY-SA-4.0

# Schulschriften migration baseline

Baseline recorded on 2026-11-10 before production-data changes.


This document's original inventory records the pre-migration repository. Its old font names, source paths, and active-coupling statements are historical only; the final search classification below identifies each remaining mention.

## Validation status

| Command | Baseline result | Taskledger check |
| --- | --- | --- |
| `npm run typecheck` | Passed | `check-0001` |
| `npm run validate` | Failed because `README.md` links to missing `01_todo.md` | `check-0002` |
| `npm test` | 114 passed, 2 failed. Both failures concern the missing `01_todo.md` target and its required SPDX header. | `check-0003` |
| `npm run build` | Passed | `check-0004` |
| `npm run test:e2e` | Browser launch failed for all 34 tests because Chromium could not load `libglib-2.0.so.0` in this environment. | `check-0005` |

No production font or model records had been changed when these commands ran.

## Playwrite inventory

The repository search found active Playwrite coupling in:

- four model `reference_fonts` fields and model descriptions;
- four font records, four bundled TTF assets, and the Playwrite OFL license;
- the Grundschrift source note;
- `tests/data/font-integrity.test.js` and `tests/e2e/reference-set.spec.ts`;
- English and German corpus copy in `src/lib/i18n.ts`;
- `README.md`, `THIRD_PARTY_NOTICES.md`, and `docs/roadmap-implementation.md`.

The supplied migration specification and Taskledger plan also mention Playwrite as migration context. Those are planning documents, not runtime font dependencies. The final search must classify each remaining match, not treat specification text as an active dependency.


## Final case-insensitive search classification

The final repository search found no active references in application code, canonical data, tests, asset filenames, package manifests, or current third-party notices. Remaining matches are confined to these historical records:

| File | Classification |
| --- | --- |
| `docs/roadmap-implementation.md` | Earlier task-0003 status snapshot. Its baseline and progress mention are historical; the current CTAN migration is tracked separately. |
| `docs/schulschriften-migration-baseline.md` | This file preserves the pre-migration inventory and records the final classification. |
| `plan.md` | Accepted task plan with migration acceptance criteria and sequencing; dependency names refer to the original baseline. |
| `schreibatlas_ctan_schulschriften_migration_plan.md` | Supplied source specification. Names, paths, and dependency states describe the pre-migration repository and planned removal. |

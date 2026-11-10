<!-- SPDX-License-Identifier: CC-BY-SA-4.0 -->
# Contributing to Schreibatlas

Schreibatlas is a static, source-backed reference project. Contributions must preserve evidence, licensing, privacy, and the distinction between digital reference shapes and handwriting movement.

## Before opening a pull request

1. Read [the data contribution guide](docs/data-contributions.md) and [the provenance review checklist](docs/provenance-review-checklist.md).
2. Use a template from `templates/` as a starting point. Replace every placeholder and do not submit template records as evidence.
3. Confirm that each source supports the exact claim and that the source, image, font, or outline may be redistributed under the recorded license. A URL alone is not redistribution permission.
4. Mark uncertain or incomplete data as `draft` or `unknown`. Do not upgrade a record to `source-backed`, `reviewed`, or `verified` without the evidence and review required by the data policy.
5. Keep user-selected photographs and handwriting samples out of the repository, build artifacts, logs, issue attachments, and generated offline cache.

## Local checks

Run these commands from the repository root:

```sh
npm ci
npm run typecheck
npm run validate
npm test
npm run build
npm run test:e2e
```

The build generates a static offline precache manifest in `dist/offline-precache.json`. It contains built application pages and assets, not user-selected images or generated reports.
Project-authored source, templates, and data records carry file-level SPDX identifiers enforced by `npm run validate`. JSON files cannot carry comments, so their licensing is documented by the repository license files and the relevant schema or manifest metadata. See [dataset release instructions](docs/dataset-releases.md) before preparing a release; publication is restricted to maintainers.

## Pull requests and visual previews

Use the pull request template and include the relevant sources, license evidence, verification status, and limits. Pull requests build a static preview and capture screenshots of the German and English landing pages, the German analysis page, English licensing page, and a German reference letter page. Download the `schreibatlas-pr-visual-preview` artifact from the workflow run to inspect the generated site and screenshots.

Before requesting review, complete the [provenance review checklist](docs/provenance-review-checklist.md). Reviewers must reject claims that are not supported by the cited record, even if the output looks plausible.

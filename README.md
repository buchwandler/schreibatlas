<!-- SPDX-License-Identifier: CC-BY-SA-4.0 -->
# Schreibatlas

Schreibatlas is a bilingual, source-backed handwriting reference atlas in development. The current corpus is a small, partial German research set, not a complete or authoritative account of any handwriting repertoire.

## Corpus and evidence limits

The canonical dataset currently contains one country, one language, five model records (two source-documented German models and three synthetic demos), seven source records, eleven glyph outlines, and two locally packaged reference fonts. It contains no verified production stroke sequences. Check each model, glyph, font, and source record for its own scope, verification status, and license.

The Volksschrift font correspondence is partial. Langula Kurrent is a modern visual-only adaptation, not an authoritative reconstruction of Johann Thomas Loth's 1866 chart. Recorded outlines describe final contours only. They do not establish pen movement, stroke order, or writing instruction. No complete repertoire is claimed.

## Features and limitations

- The German and English atlas pages expose recorded models, repertoires, glyph outlines, sources, licenses, and verification states. Missing outlines remain missing. System-font shapes are never substituted for handwriting records.
- Letter comparison normalizes recorded vector outlines to their documented baseline and x-height. Word and sentence comparison shapes explicit user text with locally bundled fonts through browser shaping. Shaping behavior depends on the browser, broad repertoire coverage is incomplete, and cross-browser equivalence is unverified. Sentence spacing is a display aid, not a measured handwriting rhythm.
- Worksheets use available source-backed outlines and preserve settings, provenance, and page fiducials in SVG, PNG, and PDF exports. PNG and PDF are rendered locally in the browser at a fixed resolution; pixel equivalence across browsers and platforms is not claimed.
- Direct writing captures pointer or keyboard input locally in the browser tab. Movement observations require verified, sourced stroke sequences. None are currently available for the model records, so movement comparison is unavailable for them.
- Photo analysis keeps selected images local. It supports manual page corners, optional matching worksheet fiducials, and bounded reference fitting against a bundled digital font. Reference, overlay, and difference views are provided; uncertain measurements are withheld. This is not OCR, a handwriting-quality score, or a comparison with an exact historical handwriting sample.
- The static build generates an offline precache manifest for built pages and assets. User-selected images and generated analysis reports are excluded.
- The versioned static API is generated under `public/data/v1/` and includes country, language, model, source, font, glyph, and stroke exports.

## Development

Requirements: Node.js 22.23.4 or newer and npm 9.6.5 or newer.

```bash
npm ci
npx playwright install --with-deps chromium
npm run dev
```

Stop the local development server with `npx astro dev stop`.

Run the project checks and static build with:

```bash
npm run typecheck
npm run validate
npm test
npm run build
npm run test:e2e
```

`npm run validate` checks repository metadata, file-level SPDX headers, data schemas, references, licenses, assets, and Unicode routes. `npm run build` writes the static site to `dist/` and generates `dist/offline-precache.json`.

Set `SITE_BASE_PATH=/schreibatlas` when building for the GitHub Pages project URL. Set `SITE_BASE_PATH=/` for a root-path custom domain such as `schreibatlas.de`.

Authored YAML records live under `data/`; JSON Schemas live under `schema/`. Generated API files in `public/data/v1/` must not be edited by hand. Read [CONTRIBUTING.md](CONTRIBUTING.md) and the [data contribution guide](docs/data-contributions.md) before adding records or assets.

The manual dataset release workflow packages a partial research corpus after validation. No dataset release has been published yet. See [dataset release instructions](docs/dataset-releases.md).

## Deployment

Pull requests and pushes to `main` run CI. The Pages workflow builds the static site and deploys only `dist/` through GitHub Pages Actions. Configure the repository's Pages source to **GitHub Actions**.

The root path offers a language chooser. German and English homes are available directly at `/de/` and `/en/`; each page sets its document language, canonical URL, and reciprocal `hreflang` links. The bilingual licensing and provenance pages are at `/de/about/` and `/en/about/`.

The original `index.html`, `app.js`, and `styles.css` prototype are retained temporarily as implementation references and are not authoritative data.

## Licensing

- Software: Apache-2.0, see `LICENSE`.
- Original project content and data: CC BY-SA 4.0, see `LICENSE-CONTENT`.
- Third-party assets retain their original licenses. See `THIRD_PARTY_NOTICES.md` and the license files distributed with each asset.

The initial repository audit and implementation checklist are preserved in [`01_todo.md`](01_todo.md). The initial audit section is historical; current limits are summarized at the end of that file.

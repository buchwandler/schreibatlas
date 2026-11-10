<!-- SPDX-License-Identifier: CC-BY-SA-4.0 -->
# Schreibatlas

Schreibatlas is a bilingual, source-backed handwriting reference atlas in development. The current corpus is a small, partial German research set, not a complete or authoritative account of any handwriting repertoire.

## Corpus and evidence limits

The canonical dataset currently contains one country, one language, nine model records (six source-documented German models and three synthetic demos), thirteen source records, eleven glyph outlines, and six locally packaged reference fonts. Grundschrift, LA, SAS and VA use pinned Playwrite v1.003 visual/shaping references. Their declared browsing inventories are explicitly incomplete as educational-model inventories. No verified production stroke sequences are available.

The Volksschrift font correspondence is partial. Langula Kurrent is a modern visual-only adaptation, not an authoritative reconstruction of Johann Thomas Loth's 1866 chart. Recorded outlines describe final contours only. They do not establish pen movement, stroke order, or writing instruction. No complete repertoire is claimed.

## Features and limitations

- The German and English atlas pages expose recorded models, repertoires, glyph outlines, sources, licenses, and verification states. Missing outlines remain missing. System-font shapes are never substituted for handwriting records.
- Letter comparison normalizes recorded outlines and labeled local-font references to shared baseline/x-height guides, with 2–6-model grid/strip views and overlays limited to three. Word and sentence comparison uses local browser shaping with explicit OpenType feature settings and font-version provenance. Cross-browser equivalence remains unverified; sentence spacing is a display aid, not a measured handwriting rhythm.
- Worksheets offer recorded-vector and reference-font modes, with independent guidelines and SVG, PNG, and PDF exports. Font-mode SVGs embed the pinned local font and complete OFL text; all formats preserve font/version/license metadata and visibly label the reference font. PNG and PDF render locally at a fixed resolution; cross-platform pixel equivalence is not claimed.
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

On systems where the downloaded Chromium cannot load its shared libraries, explicitly select an installed compatible browser with `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/path/to/chromium npm run test:e2e`. This changes the test executable only, not the deployed site.
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

The gap review and implementation roadmap are preserved in [`01_todo.md`](01_todo.md). Track current implementation evidence and remaining gaps in [the roadmap implementation matrix](docs/roadmap-implementation.md).

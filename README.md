# Schreibatlas

Schreibatlas is an open, source-backed handwriting atlas in development. The project is moving from a small static prototype toward the data-first architecture described in `01_todo.md`. Demo models and instructions are illustrative placeholders, not verified handwriting standards.

## Development

Requirements: Node.js 22.23.4 or newer and npm 9.6.5 or newer.

```bash
npm ci
npx playwright install --with-deps chromium
npm run dev
```

Stop the local development server with `npx astro dev stop`.

Run the repository checks and static build with:

```bash
npm run typecheck
npm run validate
npm test
npm run build
npm run test:e2e
```

The production site is written to `dist/`. Set `SITE_BASE_PATH=/schreibatlas` when building for the GitHub Pages project URL. Set `SITE_BASE_PATH=/` for a root-path custom domain such as `schreibatlas.de`.

The original `index.html`, `app.js`, and `styles.css` prototype are retained temporarily as implementation references. They contain demo content and are not authoritative data.

## Data records

Authored YAML records live under `data/countries/`, `data/languages/`, `data/models/`, and `data/sources/`. JSON Schemas for countries, languages, models, glyphs, sources, fonts, and strokes live in `schema/`. The current model records are synthetic demos with draft verification and empty character repertoires. There are no authoritative glyph or stroke records. Optional SVG outline paths represent final contours only and require the glyph record's license and source metadata.


Each build regenerates the versioned JSON API under `public/data/v1/`. Treat those files as generated output and do not edit them by hand.
Stroke records require a matching glyph, explicit source and license, contiguous stroke numbers, and simple SVG path assets using `viewBox="0 0 1 1"`. Static diagrams and the optional one-shot animation use the same paths. Animation is never automatic, respects reduced-motion preferences, and marks unsourced playback duration as illustrative.

Unicode glyph filenames use uppercase code-point sequences, and route slugs use lowercase `u`-prefixed code points. Do not infer handwriting facts or official stroke order from these demo records or from fonts.


The bilingual atlas includes `/de/explore/` and `/en/explore/`, generated model pages, model-specific repertoires, and `/de/compare/letters/` plus `/en/compare/letters/`. Unicode letter routes require validated glyph records. Letter comparison uses explicit final-form vector outlines, mapping sourced baselines to `0` and x-heights to `1`; it never substitutes system-font shapes when outline data is absent.

`/de/compare/words/` and `/en/compare/words/` accept local text and use browser OpenType shaping with locally packaged reference fonts only. Normalized rendering requires source-backed x-height calibration and displays font correspondence limits. Until font records are available, the page shows only a literal text preview, not a handwriting sample.
`/de/practice/` and `/en/practice/` generate printable SVG worksheets with page, margin, guide, reference, tracing, blank-row, and repetition settings. Exercise text is a printed prompt only. Documented isolated vector outlines are used when available; missing forms remain blank, and no handwriting shapes are inferred. Settings are encoded in the URL fragment so they are not sent in the page request. SVG metadata records settings, data version, model, outline provenance, a worksheet ID, marker positions, and calibrated blank-row geometry. The photo-analysis route can read the matching SVG locally and rectify against its fiducials. It reports blank-row measurements and only clusters repeated isolated shapes when segmentation and bounded similarity fitting meet confidence requirements. It does not recognize text or rate handwriting.
`/de/write/` and `/en/write/` capture pointer or keyboard strokes in the browser tab. Samples, optional Pointer Events pen pressure, and basic path geometry stay in memory until the user explicitly downloads JSON or SVG. No capture data is uploaded, and reference overlays are offered only for sourced isolated final-form outlines.
`/de/analyze/` and `/en/analyze/` accept PNG, JPEG, or WebP files for local preview, manual four-corner crop, optional local worksheet-marker recognition and calibrated rectification from a matching SVG, deskew, thresholding, and preliminary line geometry in a Web Worker. The expected text and selected model are context only, not inputs to OCR or model scoring. Images are neither uploaded nor persisted, and the baseline candidate is explicitly labeled a low-confidence lower-ink-edge estimate.
Analysis reports and the annotated PNG are downloaded only after an explicit action. A same-origin service worker caches static pages and assets for offline use; it does not cache query URLs, selected images, or analysis measurements. The analysis route warms its worker while online and shows whether the offline cache is ready.

## Deployment

Pull requests and pushes to `main` run the CI workflow. The Pages workflow builds the static site and deploys only `dist/` through GitHub Pages Actions. Configure the repository's Pages source to **GitHub Actions**.


The root path offers a language chooser. German and English homes are available directly at `/de/` and `/en/`; each page sets its document language, canonical URL, and reciprocal `hreflang` links.

## Licensing

- Software: Apache-2.0, see `LICENSE`.
- Original project content and data: CC BY-SA 4.0, see `LICENSE-CONTENT`.
- Third-party assets retain their original licenses. See `THIRD_PARTY_NOTICES.md`.

No authoritative handwriting facts or stroke orders are inferred from demo models or font outlines.

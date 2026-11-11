<!-- SPDX-License-Identifier: Apache-2.0 -->
# Reproducible CTAN Schulschriften browser fonts
This directory contains the pinned, reproducible generator and verification suite for five browser-font derivatives of CTAN `schulschriften` v5. The generated TTFs are project derivatives, not official upstream TrueType files. Their checked-in production counterparts are registered as local references for LA, SAS, VA, Sütterlin, and Deutsche Normalschrift.

## Toolchain and commands

The Nix flake and lock pin the conversion and rendering toolchain. From the repository root, regenerate the fonts, TFM files, and provenance records with:

```sh
nix develop ./tools/fonts/schulschriften --command python3 tools/fonts/schulschriften/build.py
```

Compare all five browser fonts with their CTAN TFM shaping references using Chromium:

```sh
nix develop ./tools/fonts/schulschriften --command python3 tools/fonts/schulschriften/verify_profiles.py
```

The TeX, METAFONT, mftrace, Potrace, t1utils, FontTools, HarfBuzz, Chromium, Playwright, and Pillow dependencies are confined to this flake. They are not part of normal site builds.

## Source and derivation

The source archive is `vendor/ctan/schulschriften/schulschriften-v5.zip`, SHA-256 `b33215791baec691dda5b1bac5a57cc50fadc931dc43c09759d77c0c404e72fc`. The package is distributed under LPPL-1.3c. See the upstream record, license text, and per-font provenance files for source hashes and attribution.

The generator builds five distinct profiles from the upstream METAFONT sources:

| Profile | CTAN source | Browser family |
| --- | --- | --- |
| LA | `wela` | Schreibatlas Schulschriften LA |
| SAS | `wesa` | Schreibatlas Schulschriften SAS |
| VA | `weva` | Schreibatlas Schulschriften VA |
| Sütterlin | `wesu` | Schreibatlas Schulschriften Sütterlin |
| Deutsche Normalschrift | `wedn` | Schreibatlas Schulschriften Deutsche Normalschrift |

`build.py` extracts each source from the pinned archive and explicitly points METAFONT at that extracted directory. `mftrace` and Potrace produce the initial TrueType outlines. The generator then applies the profile-specific Unicode mapping, preserves TFM advances at 10,000 units per em, and reconstructs ligature and kerning features from the raw TFM instruction tables. It preserves TeX's first-match behavior when a TFM ligature program contains duplicate right-character instructions. Contextual rules are emitted in repeated OpenType `calt` passes ordered by source character; kerning uses `kern`.

Each font uses distinct zero-width word-boundary controls U+00A7 and U+00B6. The verification renderer surrounds each whitespace-delimited word with these controls so the browser derivative receives the same word-edge context as TeX. These controls are shaping internals, not part of the writing repertoire.

Each generated TTF has a separate browser family name, a complete provenance record, and a checksum entry. The records identify the pinned CTAN source, exact source and mapping hashes, TFM hash, tool versions, shaping configuration, Unicode coverage, calibration measurements, and output hash. The TFM files are retained beside the browser derivatives for reproducible comparison.

## Parity and visual review

`verify_profiles.py` checks source and artifact hashes, Unicode coverage, `calt` and `kern` features, browser font loading, word-boundary shaping, TFM advance parity, x-height, space calibration, and visual artifacts for all five profiles. The latest recorded run used Chromium 157.0.8103.38, Playwright 1.65.0, and Node v22.23.4. All profiles passed the 0.1 CSS-pixel tolerance:

| Profile | Maximum absolute advance error |
| --- | ---: |
| LA | 0.02063 px |
| SAS | 0.02552 px |
| VA | 0.04614 px |
| Sütterlin | 0.04260 px |
| Deutsche Normalschrift | 0.01765 px |

The side-by-side visual comparisons are in `reports/`. CTAN reference renders appear on the left and Chromium renders on the right. These images are human review evidence, not pixel-equality tests. Machine-readable reports and per-case browser measurements are retained alongside the images. The aggregate result is `reports/font-profiles-parity.json`.

## Production use

The connected-text parity gate passed for all five profiles, and the production models and local assets now use these derivatives. Grundschrift intentionally has no reference font. The CTAN package and each derived font remain distinguishable through their separate source, artifact hashes, and provenance records.

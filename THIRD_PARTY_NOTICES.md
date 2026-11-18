<!-- SPDX-License-Identifier: CC-BY-SA-4.0 -->
# Third-party notices

Bundled third-party fonts retain their original licenses. They are not covered by the project's CC BY-SA 4.0 content license. Font outlines are visual reference data, not evidence of writing movement.

## Langula Kurrent

- Record: `font-langula-kurrent` (`data/fonts/langula-kurrent.yaml`).
- Creator: Langula, based on Peter Wiegel's Greifswalder Deutsche Schrift.
- Source: https://langula.app/en/old-german-script/fonts/
- License: SIL Open Font License 1.1 (OFL-1.1).
- Bundled file: `assets/fonts/langula-kurrent/LangulaKurrent-Regular.ttf`.
- License and copyright notices: `licenses/OFL-1.1-Langula-Kurrent.txt`, distributed alongside the generated font asset.
- Modifications: none to the bundled font. Project calibration metadata is separate.
- Scope: visual-only correspondence to the Loth Kurrent record; no exact historical reconstruction is claimed.

## Volksschrift UNZ1#

- Record: `font-volksschrift` (`data/fonts/volksschrift.yaml`).
- Creator: Peter Wiegel (CAT-Fonts).
- Source: https://www.peter-wiegel.de/Volksschrift.html
- License: SIL Open Font License 1.1 (OFL-1.1).
- Bundled file: `assets/fonts/de-volksschrift/Volksschrift-UNZ1.ttf`.
- License and copyright notices: `licenses/OFL-1.1-Volksschrift.txt`, distributed alongside the generated font asset.
- Modifications: none to the bundled font. Project calibration metadata is separate.
- Scope: partial digital interpretation of Deutsche Volksschrift, not a verified movement reference.

For both fonts, retain the copyright and license text on redistribution and observe the OFL's reserved-name and modification terms. The complete bundled license texts are authoritative.
## CTAN schulschriften v5 browser derivatives

- Upstream: Walter Entenmann's CTAN `schulschriften` package, version 5. Source archive SHA-256: `b33215791baec691dda5b1bac5a57cc50fadc931dc43c09759d77c0c404e72fc`.
- License: LPPL-1.3c. The pinned archive is retained in `vendor/ctan/schulschriften/`; the complete license text is `licenses/LPPL-1.3c-Schulschriften.txt`.
- Profiles and records: `font-schulschriften-la`, `font-schulschriften-sas`, `font-schulschriften-va`, `font-schulschriften-suetterlin`, and `font-schulschriften-dn`.
- Browser assets: `assets/fonts/schulschriften-{la,sas,va,suetterlin,dn}/`. These TrueType files are generated derivatives, not TrueType fonts distributed by CTAN.
- Derivation recipe, Unicode mappings, TFM inputs, toolchain, output hashes, and per-font provenance are recorded under `tools/fonts/schulschriften/` and exported with the versioned font API records.
- Attribution and redistribution: retain the upstream attribution and complete LPPL text, and follow the license conditions for the source and generated derivatives.
- Scope: the derivatives represent the five corresponding package fonts. They do not establish official source traces, educational repertoire completeness, stroke order, or writing movement.

## Grundschrift Regular

- Record: `font-urff-grundschrift` (`data/fonts/urff-grundschrift.yaml`).
- Creator and attribution: Grundschrift von Christian Urff. Copyright © 2016 by Christian Urff.
- Source: https://github.com/christianurff/grundschrift/releases/tag/v3.0 (commit `0545c85000d24fef9eb939832dc8427afad8ad5d`).
- License: [Creative Commons Attribution 3.0 Unported (CC-BY-3.0)](https://creativecommons.org/licenses/by/3.0/). Retain attribution and the license on redistribution. The upstream notice and license text are distributed with the font in `licenses/CC-BY-3.0-Urff-Grundschrift.txt`.
- Bundled file: `assets/fonts/urff-grundschrift/Grundschrift-Regular.otf`. No modifications; calibration metadata is separate.
- Scope: independent visual reference, not the Grundschulverband's font, an official source trace, or a record of writing movement.

Future third-party material must be listed here with its record ID, name, creator, source URL, original license, bundled files, attribution requirements, and modifications. New font records are checked against this notice during repository validation.

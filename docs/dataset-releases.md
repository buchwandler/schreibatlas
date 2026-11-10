<!-- SPDX-License-Identifier: CC-BY-SA-4.0 -->
# Dataset releases

Dataset packages are explicitly partial research snapshots. The archive includes canonical `data/` records, generated public exports, licenses, notices, a corpus-scope manifest, and SHA-256 checksums. It does not claim complete repertoires, authoritative font correspondence, or handwriting movement evidence.

## Review a candidate package locally

Run the project checks and build the exports before packaging:

```sh
npm ci
npm run validate
npm run build:data
node tools/package-data-release.mjs 0.1.0 /tmp/schreibatlas-release
unzip -t /tmp/schreibatlas-release/schreibatlas-data-v0.1.0.zip
(cd /tmp/schreibatlas-release && sha256sum -c schreibatlas-data-v0.1.0.zip.sha256)
```

Inspect `dataset-manifest.json`, model/source/font scope, licenses, and `SHA256SUMS` in the extracted archive. Use a new stable `X.Y.Z` version for each release. The package command refuses a version whose output directory already exists.

## Publish

A maintainer manually starts the `Dataset release` workflow from the `main` branch and supplies the stable version. The workflow validates the records, builds exports, packages the dataset, then creates the immutable `data-vX.Y.Z` GitHub release with the archive and its checksum file. It never packages user-selected photos, handwriting captures, or generated analysis reports.

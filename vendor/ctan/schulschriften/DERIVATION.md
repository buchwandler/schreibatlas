# SPDX-License-Identifier: CC-BY-SA-4.0

# CTAN Schulschriften derivation policy

The complete unmodified `schulschriften` Version 5 archive is retained as `schulschriften-v5.zip`. Its checksum is recorded in `SHA256SUMS`, and its exact source URL, retrieval date, license evidence, and source font names are recorded in `UPSTREAM.txt`.

Browser fonts generated for Schreibatlas are derivatives or compiled artifacts of the upstream METAFONT work. They are not CTAN-distributed TrueType fonts and must use distinct Schreibatlas family and PostScript names. Every generated font must have a corresponding `assets/fonts/<font-id>/DERIVATION.md` record containing:

- upstream package version, source font file, and archive SHA-256;
- exact conversion command and tool versions;
- source modification or patch status;
- Unicode remapping and connection/ligature-to-OpenType conversion;
- name-table changes and actual required OpenType features;
- generated output SHA-256 and calibration measurements;
- a notice that Schreibatlas is responsible for its converted browser asset;
- instructions and a link for obtaining the complete unmodified upstream work.

The conversion recipe must consume the pinned local archive. It must not fetch mutable CTAN content during a normal site build, and the conversion toolchain must remain separate from the normal site-build dependencies. A conversion that loses connected-text behavior is not acceptable as a digital reference. Source fixes and patches must be recorded, not applied silently. The upstream archive remains unchanged.

#!/usr/bin/env python3
"""Build reproducible browser-font derivatives for CTAN schulschriften v5."""

from __future__ import annotations

import argparse
import hashlib
import json
import os

import re
import shutil
import subprocess
import struct
import tempfile
import zipfile
from collections import Counter
from pathlib import Path, PurePosixPath

from fontTools import version as fonttools_version
from fontTools.feaLib.builder import addOpenTypeFeaturesFromString
from fontTools.pens.boundsPen import BoundsPen
from fontTools.ttLib.scaleUpem import scale_upem
from fontTools.ttLib import TTFont
from fontTools.ttLib.tables._g_l_y_f import Glyph
from fontTools.tfmLib import TFM

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
ARCHIVE = ROOT / "vendor/ctan/schulschriften/schulschriften-v5.zip"
PROFILES_PATH = HERE / "profiles.json"
LOCK_PATH = HERE / "flake.lock"
EXPECTED_ARCHIVE_SHA256 = "b33215791baec691dda5b1bac5a57cc50fadc931dc43c09759d77c0c404e72fc"
RESERVED_SOURCE_GLYPHS = {".notdef", ".null", "nonmarkingreturn"}
SHAPING_ROUNDS = 2
BROWSER_UNITS_PER_EM = 10_000
FIXED_MAC_TIMESTAMP = 3_029_529_600


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def codepoint(value: str) -> int:
    return int(value.removeprefix("U+"), 16)


def run_text(
    args: list[str], *, cwd: Path | None = None, env: dict[str, str] | None = None
) -> str:
    result = subprocess.run(args, cwd=cwd, env=env, check=True, capture_output=True, text=True)
    return (result.stdout + result.stderr).strip()



def read_tfm_programs(
    tfm_path: Path,
) -> tuple[dict[int, dict[int, tuple[str, int]]], dict[int, dict[int, float]]]:
    data = tfm_path.read_bytes()
    _, lh, bc, ec, nw, nh, nd, ni, nl, nk, _, _ = struct.unpack_from(">12H", data)
    char_base = 6 + lh - bc
    lig_kern_base = char_base + ec + 1 + nw + nh + nd + ni
    kern_base = lig_kern_base + nl

    def command(index: int) -> tuple[int, int, int, int]:
        return struct.unpack_from(">4B", data, 4 * (lig_kern_base + index))

    programs = {}
    if nl:
        last = command(nl - 1)
        if last[0] == 255:
            programs[256] = 256 * last[2] + last[3]

    for character in range(bc, ec + 1):
        info = 4 * (char_base + character)
        if data[info + 2] % 4 == 1:
            programs[character] = data[info + 3]

    ligatures = {}
    kerning = {}
    for left, pointer in sorted(programs.items()):
        skip, _, op, remainder = command(pointer)
        if skip > 128:
            pointer = 256 * op + remainder
        seen_right = set()
        index = pointer
        while index < nl:
            skip, right, op, remainder = command(index)
            if skip <= 128 and right not in seen_right:
                seen_right.add(right)
                if op >= 128:
                    kern_index = 256 * (op - 128) + remainder
                    value = struct.unpack_from(">i", data, 4 * (kern_base + kern_index))[0] / 2**20
                    kerning.setdefault(left, {})[right] = value
                else:
                    operation = op
                    if operation == 4 or (operation > 7 and operation != 11):
                        name = str(operation)
                    else:
                        name = "/" if operation % 4 > 1 else ""
                        name += "LIG"
                        if operation % 2:
                            name += "/"
                        while operation > 3:
                            name += ">"
                            operation -= 4
                    ligatures.setdefault(left, {})[right] = (name, remainder)
            if skip >= 128:
                break
            index += skip + 1

    return ligatures, kerning


def tool_versions() -> dict[str, str]:
    lock = json.loads(LOCK_PATH.read_text(encoding="utf-8"))
    nixpkgs = lock["nodes"]["nixpkgs"]["locked"]
    mf_version = run_text(["mf", "--version"])
    mf_match = re.search(r"Version\s+([\w.]+)", mf_version)
    return {
        "nixpkgs_revision": nixpkgs["rev"],
        "mftrace": run_text(["mftrace", "--version"]).splitlines()[0],
        "metafont": mf_match.group(1) if mf_match else mf_version.splitlines()[0],
        "harfbuzz": run_text(["hb-shape", "--version"]).splitlines()[0],
        "potrace": run_text(["potrace", "--version"]).splitlines()[0],
        "t1utils": os.environ["T1UTILS_VERSION"],
        "texlive": run_text(["tex", "--version"]).splitlines()[0],
        "python": run_text(["python3", "--version"]),
        "fonttools": fonttools_version,
    }


def extract_sources(work_dir: Path, source_stem: str) -> tuple[Path, list[str]]:
    prefix = f"schulschriften/source/{source_stem}/"
    source_dir = work_dir / "source" / source_stem
    source_dir.mkdir(parents=True)
    with zipfile.ZipFile(ARCHIVE) as archive:
        for item in archive.infolist():
            if not item.filename.startswith(prefix) or not item.filename.endswith(".mf"):
                continue
            relative = PurePosixPath(item.filename).relative_to(prefix)
            destination = source_dir.joinpath(*relative.parts)
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(archive.read(item))
    source_files = sorted(path.name for path in source_dir.glob("*.mf"))
    required_files = {f"{source_stem}14.mf", f"{source_stem}14_lig.mf"}
    missing = sorted(required_files - set(source_files))
    if missing:
        raise FileNotFoundError(f"Missing CTAN source files for {source_stem}: {missing}")
    return source_dir, source_files


def add_empty_glyph(font: TTFont, name: str, advance: int) -> None:
    if name in font.getGlyphOrder():
        raise ValueError(f"Glyph already exists: {name}")
    glyph = Glyph()
    glyph.numberOfContours = 0
    font["glyf"][name] = glyph
    font["hmtx"].metrics[name] = (advance, 0)
    font.setGlyphOrder(font["glyf"].glyphOrder)


def set_name(font: TTFont, name_id: int, value: str) -> None:
    name_table = font["name"]
    name_table.names = [record for record in name_table.names if record.nameID != name_id]
    name_table.setName(value, name_id, 3, 1, 0x409)
    name_table.setName(value, name_id, 1, 0, 0)


def unicode_map(mapping: dict, code_glyph: dict[int, str]) -> dict[int, str]:
    mapping_data = mapping["unicode_mapping"]
    first = codepoint(mapping_data["ascii_identity_range"]["start"])
    last = codepoint(mapping_data["ascii_identity_range"]["end"])
    result = {value: code_glyph[value] for value in range(first, last + 1) if value in code_glyph}
    for unicode_code, tfm_code in mapping_data["explicit_tfm_codes"].items():
        result[codepoint(unicode_code)] = code_glyph[tfm_code]
    result[codepoint(mapping_data["space"])] = "space"
    markers = mapping["word_boundary_markers"]
    result[codepoint(markers["start"]["codepoint"])] = markers["start"]["glyph_name"]
    result[codepoint(markers["end"]["codepoint"])] = markers["end"]["glyph_name"]
    return result


def gsub_rules(
    ligatures: dict[int, dict[int, tuple[str, int]]],
    code_glyph: dict[int, str],
    mapping: dict,
    shaping_rounds: int,
) -> tuple[str, dict[str, int]]:
    groups = {
        name: []
        for name in (
            "start_lig",
            "start_ctx_keep",
            "start_ctx_replace",
            "lig",
            "ctx_left",
            "ctx_right",
            "ctx_both",
            "end_replace",
            "end_keep",
        )
    }
    internal_by_left = {}
    start_glyph = mapping["word_boundary_markers"]["start"]["glyph_name"]
    end_glyph = mapping["word_boundary_markers"]["end"]["glyph_name"]

    for left in sorted(ligatures):
        for right, (operation, result) in sorted(ligatures[left].items()):
            current = start_glyph if left == 256 else code_glyph[left]
            following = end_glyph if right == 32 else code_glyph[right]
            ligature = code_glyph[result]

            if left == 256:
                if operation == "LIG":
                    group, rule = "start_lig", f"sub {current} {following} by {ligature};"
                elif operation in ("LIG/", "/LIG/"):
                    group, rule = "start_ctx_keep", f"sub {current} {following}' by {ligature} {following};"
                elif operation == "/LIG":
                    group, rule = "start_ctx_replace", f"sub {current} {following}' by {ligature};"
                else:
                    raise ValueError(f"Unsupported TFM start-boundary operation: {operation}")
                groups[group].append(rule)
            elif right == 32:
                if operation in ("LIG", "LIG/"):
                    group, rule = "end_replace", f"sub {current}' {following} by {ligature};"
                else:
                    group, rule = "end_keep", f"sub {current}' {following} by {current} {ligature};"
                groups[group].append(rule)
            else:
                if operation == "LIG":
                    group, rule = "lig", f"sub {current} {following} by {ligature};"
                elif operation == "LIG/":
                    group, rule = "ctx_left", f"sub {current}' {following} by {ligature};"
                elif operation == "/LIG":
                    group, rule = "ctx_right", f"sub {current} {following}' by {ligature};"
                elif operation == "/LIG/":
                    group, rule = "ctx_both", f"sub {current}' {following} by {current} {ligature};"
                else:
                    raise ValueError(f"Unsupported TFM ligature operation: {operation}")
                groups[group].append(rule)
                internal_by_left.setdefault(left, {}).setdefault(group, []).append(rule)

    lines = ["feature calt {"]
    for round_index in range(shaping_rounds):
        for name in ("start_lig", "start_ctx_keep", "start_ctx_replace"):
            rules = groups[name]
            if rules:
                lookup_name = f"{name}_{round_index}"
                lines.append(f"  lookup {lookup_name} {{")
                lines.extend(f"    {rule}" for rule in rules)
                lines.append(f"  }} {lookup_name};")
        for left, operation_groups in sorted(internal_by_left.items()):
            for name in ("lig", "ctx_left", "ctx_right", "ctx_both"):
                rules = operation_groups.get(name, [])
                if rules:
                    lookup_name = f"{name}_{left}_{round_index}"
                    lines.append(f"  lookup {lookup_name} {{")
                    lines.extend(f"    {rule}" for rule in rules)
                    lines.append(f"  }} {lookup_name};")
        for name in ("end_replace", "end_keep"):
            rules = groups[name]
            if rules:
                lookup_name = f"{name}_{round_index}"
                lines.append(f"  lookup {lookup_name} {{")
                lines.extend(f"    {rule}" for rule in rules)
                lines.append(f"  }} {lookup_name};")
    lines.append("} calt;")
    return "\n".join(lines), {name: len(rules) for name, rules in groups.items()}


def gpos_kern(
    kerning: dict[int, dict[int, float]],
    code_glyph: dict[int, str],
    units_per_em: int,
    mapping: dict,
) -> tuple[str, int]:
    markers = mapping["word_boundary_markers"]
    start_glyph = markers["start"]["glyph_name"]
    end_glyph = markers["end"]["glyph_name"]

    def glyph_for_code(code: int) -> str:
        if code == 256:
            return start_glyph
        if code == 32:
            return end_glyph
        return code_glyph[code]

    lines = ["feature kern {"]
    pair_count = 0
    for left, pairs in sorted(kerning.items()):
        for right, value in sorted(pairs.items()):
            adjustment = round(value * units_per_em)
            lines.append(
                f"  pos {glyph_for_code(left)} {glyph_for_code(right)} <0 0 {adjustment} 0>;"
            )
            pair_count += 1
    lines.append("} kern;")
    return "\n".join(lines), pair_count



def required_characters(mapping: dict) -> list[int]:
    characters = set()
    for item in mapping["required_character_ranges"]:
        characters.update(range(codepoint(item["start"]), codepoint(item["end"]) + 1))
    return sorted(characters)


def build_font(raw_ttf: Path, tfm_path: Path, mapping: dict, output: Path) -> dict:
    tfm = TFM(str(tfm_path))
    ligatures, kerning = read_tfm_programs(tfm_path)
    font = TTFont(raw_ttf)
    scale_upem(font, BROWSER_UNITS_PER_EM)
    units_per_em = font["head"].unitsPerEm
    glyph_order = font.getGlyphOrder()
    encoded_glyphs = [name for name in glyph_order if name not in RESERVED_SOURCE_GLYPHS]
    if len(encoded_glyphs) != len(tfm.chars):
        raise ValueError(
            f"mftrace glyph order and TFM character table differ: "
            f"{len(encoded_glyphs)} glyphs versus {len(tfm.chars)} TFM characters"
        )
    code_glyph = dict(zip(sorted(tfm.chars), encoded_glyphs))
    for code, glyph in code_glyph.items():
        _, side_bearing = font["hmtx"].metrics[glyph]
        advance = round(float(tfm.chars[code]["width"]) * units_per_em)
        font["hmtx"].metrics[glyph] = (advance, side_bearing)
    for code, expected_name in {
        33: "exclam",
        44: "comma",
        46: "period",
        48: "zero",
        65: "A",
        97: "a",
        196: "Adieresis",
        214: "Odieresis",
        220: "Udieresis",
        228: "adieresis",
        246: "odieresis",
        252: "udieresis",
        255: "germandbls",
    }.items():
        if code_glyph.get(code) != expected_name:
            raise ValueError(f"Unexpected mftrace glyph for TFM code {code}: {code_glyph.get(code)}")

    shaping_rounds = mapping.get("gsub_reprocessing_rounds", SHAPING_ROUNDS)
    add_empty_glyph(font, "space", round(tfm.fontdimens["SPACE"] * units_per_em))
    markers = mapping["word_boundary_markers"]
    add_empty_glyph(font, markers["start"]["glyph_name"], 0)
    add_empty_glyph(font, markers["end"]["glyph_name"], 0)

    cmap = unicode_map(mapping, code_glyph)
    known_glyphs = set(font.getGlyphOrder())
    missing = sorted(set(cmap.values()) - known_glyphs)
    if missing:
        raise ValueError(f"Unicode mapping refers to missing glyphs: {missing}")
    for table in font["cmap"].tables:
        if table.isUnicode():
            table.cmap = dict(cmap)

    if "GSUB" in font:
        del font["GSUB"]
    if "GPOS" in font:
        del font["GPOS"]
    gsub, operation_counts = gsub_rules(ligatures, code_glyph, mapping, shaping_rounds)
    kern, kern_pair_count = gpos_kern(kerning, code_glyph, units_per_em, mapping)
    addOpenTypeFeaturesFromString(font, gsub + "\n" + kern)

    family = mapping["family_name"]
    set_name(font, 0, "CTAN schulschriften v5 by Walter Entenmann. LPPL-1.3c. See project provenance.")
    set_name(font, 1, family)
    set_name(font, 2, "Regular")
    set_name(font, 3, mapping["unique_name_id"])
    set_name(font, 4, f"{family} Regular")
    set_name(font, 5, "Version 1.0")
    set_name(font, 6, mapping["postscript_name"])
    set_name(font, 13, "Distributed under LPPL-1.3c; see the included upstream license.")
    set_name(font, 14, "https://www.latex-project.org/lppl.txt")
    set_name(font, 16, family)
    set_name(font, 17, "Regular")
    font["head"].created = FIXED_MAC_TIMESTAMP
    font["head"].modified = FIXED_MAC_TIMESTAMP
    font["head"].fontRevision = 1.0
    font["maxp"].numGlyphs = len(font.getGlyphOrder())
    font.save(output)

    built = TTFont(output)
    feature_tags = sorted(
        {record.FeatureTag for record in built["GSUB"].table.FeatureList.FeatureRecord}
        | {record.FeatureTag for record in built["GPOS"].table.FeatureList.FeatureRecord}
    )
    if feature_tags != ["calt", "kern"]:
        raise ValueError(f"Unexpected OpenType feature tags: {feature_tags}")
    cmap_coverage = sorted(
        {
            character
            for table in built["cmap"].tables
            if table.isUnicode()
            for character in table.cmap
        }
    )
    glyph_set = built.getGlyphSet()
    x_glyph = glyph_set[code_glyph[ord("x")]]
    bounds_pen = BoundsPen(glyph_set)
    x_glyph.draw(bounds_pen)
    if bounds_pen.bounds is None:
        raise ValueError("The lowercase x glyph has no measurable outline bounds")
    outline_x_height_units = round(bounds_pen.bounds[3])
    tfm_x_height_em = float(tfm.fontdimens["XHEIGHT"])
    calibration = {
        "tfm_x_height_em": round(tfm_x_height_em, 6),
        "outline_x_height_units": outline_x_height_units,
        "outline_x_glyph_y_min_units": round(bounds_pen.bounds[1]),
        "outline_x_height_em": round(outline_x_height_units / units_per_em, 6),
        "outline_minus_tfm_x_height_em": round(outline_x_height_units / units_per_em - tfm_x_height_em, 6),
        "tfm_space_advance_em": round(float(tfm.fontdimens["SPACE"]), 6),
        "space_advance_units": built["hmtx"].metrics["space"][0],
    }
    missing_required = sorted(set(required_characters(mapping)) - set(cmap_coverage))
    if missing_required:
        raise ValueError(f"Missing required Unicode characters: {missing_required}")
    return {
        "family_name": family,
        "postscript_name": mapping["postscript_name"],
        "unique_name_id": mapping["unique_name_id"],
        "units_per_em": units_per_em,
        "calibration": calibration,
        "glyph_count": len(built.getGlyphOrder()),
        "unicode_coverage": [f"U+{character:04X}" for character in cmap_coverage],
        "required_unicode_coverage": len(required_characters(mapping)),
        "tfm_ligature_rules": sum(operation_counts.values()),
        "tfm_ligature_operations": dict(sorted(Counter(tfm_op for table in ligatures.values() for tfm_op, _ in table.values()).items())),
        "gsub_rule_counts_per_operation": operation_counts,
        "gsub_reprocessing_rounds": shaping_rounds,
        "tfm_kern_pairs": kern_pair_count,
        "opentype_features": feature_tags,
    }


def main() -> None:
    all_profiles = json.loads(PROFILES_PATH.read_text(encoding="utf-8"))["profiles"]
    profile_ids = [profile["id"] for profile in all_profiles]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=HERE / "generated",
        help="Output directory for generated TTFs, source-named TFMs and provenance JSON",
    )
    parser.add_argument(
        "--profile",
        action="append",
        choices=profile_ids,
        help="Build only this profile; may be repeated",
    )
    args = parser.parse_args()

    if sha256(ARCHIVE) != EXPECTED_ARCHIVE_SHA256:
        raise SystemExit(f"CTAN archive hash mismatch: {ARCHIVE}")
    versions = tool_versions()
    args.output_dir.mkdir(parents=True, exist_ok=True)
    selected_ids = set(args.profile or profile_ids)

    for profile in all_profiles:
        if profile["id"] not in selected_ids:
            continue
        profile_id = profile["id"]
        source_stem = profile["source_stem"]
        mapping_path = HERE / "mappings" / f"{source_stem}.json"
        mapping = json.loads(mapping_path.read_text(encoding="utf-8"))
        samples_path = HERE / "expected" / f"{profile_id}-samples.json"
        if not samples_path.is_file():
            raise FileNotFoundError(f"Missing shaping fixtures: {samples_path}")

        with tempfile.TemporaryDirectory(prefix=f"schulschriften-{profile_id}-") as temporary:
            work_dir = Path(temporary)
            source_dir, source_files = extract_sources(work_dir, source_stem)
            encoding_path = Path(run_text(["kpsewhich", "tex256.enc"]))
            tfm_name = f"{source_stem}14"
            mf_environment = os.environ.copy()
            mf_environment["MFINPUTS"] = f"{source_dir}//:"
            run_text(
                [
                    "mftrace",
                    "--keep",
                    "--formats=TTF",
                    "--potrace",
                    f"--encoding={encoding_path}",
                    f"{tfm_name}.mf",
                ],
                cwd=source_dir,
                env=mf_environment,
            )
            raw_ttf = source_dir / f"{tfm_name}.ttf"
            raw_tfm = source_dir / "mftrace.dir" / f"{tfm_name}.tfm"
            if not raw_ttf.is_file() or not raw_tfm.is_file():
                raise FileNotFoundError(f"mftrace did not produce TTF and TFM for {profile_id}")

            ttf_output = args.output_dir / f"{profile_id}-prototype.ttf"
            tfm_output = args.output_dir / f"{tfm_name}.tfm"
            shutil.copyfile(raw_tfm, tfm_output)
            font_facts = build_font(raw_ttf, raw_tfm, mapping, ttf_output)
            source_hashes = {filename: sha256(source_dir / filename) for filename in source_files}
            provenance = {
                "schema_version": 1,
                "artifact_id": f"schreibatlas-ctan-schulschriften-{profile_id}-prototype",
                "profile": {
                    "id": profile_id,
                    "display_name": profile["display_name"],
                    "source_stem": source_stem,
                    "mapping": mapping_path.relative_to(ROOT).as_posix(),
                    "mapping_sha256": sha256(mapping_path),
                    "verification_fixtures": samples_path.relative_to(ROOT).as_posix(),
                    "verification_fixtures_sha256": sha256(samples_path),
                },
                "upstream": {
                    "package": "CTAN schulschriften",
                    "version": 5,
                    "script": source_stem,
                    "archive": "vendor/ctan/schulschriften/schulschriften-v5.zip",
                    "archive_sha256": EXPECTED_ARCHIVE_SHA256,
                    "license": "LPPL-1.3c",
                    "license_file": "licenses/LPPL-1.3c-Schulschriften.txt",
                    "source_files": source_hashes,
                },
                "derivation": {
                    "recipe": "tools/fonts/schulschriften/build.py",
                    "pipeline": [
                        "METAFONT source lookup restricted to extracted CTAN files, then TFM and GF generation with mftrace",
                        "Potrace tracing of generated GF bitmaps to TrueType outlines",
                        "Unicode cmap reconstruction from the profile-specific mapping",
                        "Outline scaling and TFM advance normalization to 10,000 units per em",
                        "TeX first-match TFM ligature-program translation into ordered repeated OpenType calt lookups",
                        "TFM kerning-pair translation to OpenType GPOS kern",
                        "Name, timestamp and output metadata normalization",
                    ],
                    "tool_versions": versions,
                    "unicode_mapping": mapping_path.relative_to(ROOT).as_posix(),
                    "word_boundary_controls": mapping["word_boundary_markers"],
                    "font_facts": font_facts,
                    "raw_mftrace_ttf_sha256": sha256(raw_ttf),
                    "tfm_sha256": sha256(tfm_output),
                    "tfm_path": tfm_output.relative_to(ROOT).as_posix(),
                },
                "artifact": {
                    "path": ttf_output.relative_to(ROOT).as_posix(),
                    "sha256": sha256(ttf_output),
                    "family_name": font_facts["family_name"],
                    "postscript_name": font_facts["postscript_name"],
                    "rights": "LPPL-1.3c derivative; preserve upstream and derivation attribution",
                },
            }
            provenance_path = args.output_dir / f"{profile_id}-prototype.provenance.json"
            provenance_path.write_text(
                json.dumps(provenance, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
                encoding="utf-8",
            )
            print(f"TTF: {ttf_output} sha256={sha256(ttf_output)}")
            print(f"TFM: {tfm_output} sha256={sha256(tfm_output)}")
            print(f"Provenance: {provenance_path}")

    checksum_paths = []
    for profile in all_profiles:
        profile_id = profile["id"]
        tfm_name = f"{profile['source_stem']}14.tfm"
        for path in (
            args.output_dir / f"{profile_id}-prototype.ttf",
            args.output_dir / tfm_name,
            args.output_dir / f"{profile_id}-prototype.provenance.json",
        ):
            if path.is_file():
                checksum_paths.append(path)
    checksums_path = args.output_dir / "SHA256SUMS"
    checksums_path.write_text(
        "".join(f"{sha256(path)}  {path.name}\n" for path in checksum_paths),
        encoding="ascii",
    )


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Compare all five browser derivatives with their CTAN TFM shaping references."""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import tempfile
import zipfile
from pathlib import Path, PurePosixPath

from fontTools.pens.boundsPen import BoundsPen
from fontTools.ttLib import TTFont
from fontTools.tfmLib import TFM
from PIL import Image

from verify_sas import codepoint, measure_tex, render_tex_reference, sha256

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
ARCHIVE = ROOT / "vendor/ctan/schulschriften/schulschriften-v5.zip"
GENERATED = HERE / "generated"
PROFILES_PATH = HERE / "profiles.json"
EXPECTED_ARCHIVE_SHA256 = "b33215791baec691dda5b1bac5a57cc50fadc931dc43c09759d77c0c404e72fc"


def required_characters(mapping: dict) -> list[int]:
    characters = set()
    for item in mapping["required_character_ranges"]:
        characters.update(range(codepoint(item["start"]), codepoint(item["end"]) + 1))
    return sorted(characters)


def extract_sources(work_dir: Path, source_stem: str) -> tuple[Path, dict[str, str]]:
    prefix = f"schulschriften/source/{source_stem}/"
    source_dir = work_dir / "source" / source_stem
    source_dir.mkdir(parents=True)
    with zipfile.ZipFile(ARCHIVE) as archive:
        for item in archive.infolist():
            if not item.filename.startswith(prefix) or not item.filename.endswith(".mf"):
                continue
            relative = PurePosixPath(item.filename).relative_to(prefix)
            target = source_dir.joinpath(*relative.parts)
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(archive.read(item))
    source_files = sorted(path.name for path in source_dir.glob("*.mf"))
    required_files = {f"{source_stem}14.mf", f"{source_stem}14_lig.mf"}
    if missing := sorted(required_files - set(source_files)):
        raise FileNotFoundError(f"Missing CTAN source files for {source_stem}: {missing}")
    return source_dir, {filename: sha256(source_dir / filename) for filename in source_files}


def verify_profile(profile: dict, reports: Path) -> dict:
    profile_id = profile["id"]
    source_stem = profile["source_stem"]
    mapping_path = HERE / "mappings" / f"{source_stem}.json"
    samples_path = HERE / "expected" / f"{profile_id}-samples.json"
    provenance_path = GENERATED / f"{profile_id}-prototype.provenance.json"
    font_path = GENERATED / f"{profile_id}-prototype.ttf"
    tfm_path = GENERATED / f"{source_stem}14.tfm"
    mapping = json.loads(mapping_path.read_text(encoding="utf-8"))
    samples = json.loads(samples_path.read_text(encoding="utf-8"))
    provenance = json.loads(provenance_path.read_text(encoding="utf-8"))
    font_facts = provenance["derivation"]["font_facts"]

    profile_record = provenance["profile"]
    if profile_record["mapping"] != mapping_path.relative_to(ROOT).as_posix():
        raise ValueError(f"{profile_id} provenance names the wrong Unicode mapping")
    if profile_record["verification_fixtures"] != samples_path.relative_to(ROOT).as_posix():
        raise ValueError(f"{profile_id} provenance names the wrong shaping fixtures")
    if sha256(mapping_path) != profile_record["mapping_sha256"]:
        raise ValueError(f"{profile_id} mapping hash differs from its provenance")
    if sha256(samples_path) != profile_record["verification_fixtures_sha256"]:
        raise ValueError(f"{profile_id} fixture hash differs from its provenance")

    if sha256(ARCHIVE) != EXPECTED_ARCHIVE_SHA256:
        raise ValueError(f"Pinned CTAN archive hash mismatch: {ARCHIVE}")
    if provenance["upstream"]["archive_sha256"] != EXPECTED_ARCHIVE_SHA256:
        raise ValueError(f"{profile_id} provenance points to a different archive")
    if sha256(font_path) != provenance["artifact"]["sha256"]:
        raise ValueError(f"{profile_id} TTF hash differs from its provenance")
    if sha256(tfm_path) != provenance["derivation"]["tfm_sha256"]:
        raise ValueError(f"{profile_id} TFM hash differs from its provenance")
    if provenance["derivation"]["tfm_path"] != tfm_path.relative_to(ROOT).as_posix():
        raise ValueError(f"{profile_id} provenance names the wrong TFM path")

    font = TTFont(font_path)
    cmap = font.getBestCmap()
    required = set(required_characters(mapping))
    missing = sorted(required - set(cmap))
    if missing:
        raise ValueError(f"{profile_id} font is missing required codepoints: {missing}")
    if 0x1F600 in cmap:
        raise ValueError(f"{profile_id} font unexpectedly maps the unrelated emoji U+1F600")
    features = {
        record.FeatureTag
        for table_tag in ("GSUB", "GPOS")
        for record in font[table_tag].table.FeatureList.FeatureRecord
    }
    if features != {"calt", "kern"}:
        raise ValueError(f"{profile_id} has unexpected OpenType features: {sorted(features)}")
    if font["name"].getDebugName(1) != mapping["family_name"]:
        raise ValueError(f"{profile_id} has the wrong family name")
    if font["name"].getDebugName(6) != mapping["postscript_name"]:
        raise ValueError(f"{profile_id} has the wrong PostScript name")

    markers = mapping["word_boundary_markers"]
    for edge in ("start", "end"):
        marker = markers[edge]
        marker_codepoint = codepoint(marker["codepoint"])
        if cmap.get(marker_codepoint) != marker["glyph_name"]:
            raise ValueError(f"{profile_id} has an invalid {edge} boundary marker mapping")
        if font["hmtx"].metrics[marker["glyph_name"]][0] != 0:
            raise ValueError(f"{profile_id} {edge} boundary marker must have zero advance")

    tfm = TFM(str(tfm_path))
    glyph_set = font.getGlyphSet()
    x_glyph = glyph_set[cmap[ord("x")]]
    bounds_pen = BoundsPen(glyph_set)
    x_glyph.draw(bounds_pen)
    if bounds_pen.bounds is None:
        raise ValueError(f"{profile_id} lowercase x has no measurable outline bounds")
    units_per_em = font["head"].unitsPerEm
    measured_x_height_units = round(bounds_pen.bounds[3])
    measured_x_height_em = round(measured_x_height_units / units_per_em, 6)
    tfm_x_height_em = round(float(tfm.fontdimens["XHEIGHT"]), 6)
    calibration = font_facts["calibration"]
    if calibration["outline_x_height_units"] != measured_x_height_units:
        raise ValueError(f"{profile_id} recorded x-height does not match its outline")
    if calibration["outline_x_glyph_y_min_units"] != round(bounds_pen.bounds[1]):
        raise ValueError(f"{profile_id} recorded lowercase x bounds do not match its outline")
    if calibration["tfm_x_height_em"] != tfm_x_height_em:
        raise ValueError(f"{profile_id} recorded TFM x-height does not match the generated TFM")
    if abs(measured_x_height_em - tfm_x_height_em) > 0.03:
        raise ValueError(f"{profile_id} outline x-height is not calibrated to the TFM value")
    measured_space_units = font["hmtx"].metrics["space"][0]
    tfm_space_units = round(float(tfm.fontdimens["SPACE"]) * units_per_em)
    if measured_space_units != tfm_space_units:
        raise ValueError(f"{profile_id} space advance differs from the TFM SPACE metric")

    source_hashes_recorded = provenance["upstream"]["source_files"]
    if not source_hashes_recorded:
        raise ValueError(f"{profile_id} provenance has no source-file hashes")

    glyph_cases = [chr(value) for value in sorted(required) if not chr(value).isspace()]
    cases = list(dict.fromkeys([*glyph_cases, *samples["cases"]]))
    browser_samples = {**samples, "cases": cases}
    report_prefix = f"{profile_id}-font"
    browser_result_path = reports / f"{report_prefix}-browser-widths.json"
    browser_samples_png = reports / f"{report_prefix}-browser-samples.png"
    browser_visual_png = reports / f"{report_prefix}-browser-reference.png"
    comparison_path = reports / f"{report_prefix}-visual-comparison.png"

    with tempfile.TemporaryDirectory(prefix=f"schulschriften-{profile_id}-verify-") as temporary:
        work_dir = Path(temporary)
        source_dir, source_hashes_actual = extract_sources(work_dir, source_stem)
        if source_hashes_actual != source_hashes_recorded:
            raise ValueError(f"{profile_id} source hashes differ from the pinned archive provenance")
        browser_samples_path = work_dir / "browser-samples.json"
        browser_samples_path.write_text(
            json.dumps(browser_samples, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        font_name = f"{source_stem}14"
        tex_widths_pt = measure_tex(
            cases,
            samples["tex_font_size_pt"],
            mapping,
            work_dir,
            source_dir,
            font_name=font_name,
        )
        visual_reference = render_tex_reference(
            samples["visual_cases"] + samples["visual_glyph_cases"],
            samples["tex_font_size_pt"],
            mapping,
            work_dir,
            source_dir,
            reports,
            font_name=font_name,
            report_prefix=report_prefix,
        )
        environment = {
            **os.environ,
            "SAS_FONT_PATH": str(font_path),
            "SAS_FONT_FAMILY": mapping["family_name"],
            "SAS_PROFILE_ID": profile_id,
            "SAS_SAMPLES_PATH": str(browser_samples_path),
            "SAS_BROWSER_RESULT_PATH": str(browser_result_path),
            "SAS_SAMPLES_SCREENSHOT_PATH": str(browser_samples_png),
            "SAS_VISUAL_SCREENSHOT_PATH": str(browser_visual_png),
            "PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH": shutil.which("chromium"),
        }
        subprocess.run(
            ["node", str(HERE / "verify_sas.mjs")],
            cwd=ROOT,
            env=environment,
            check=True,
        )
        browser_data = json.loads(browser_result_path.read_text(encoding="utf-8"))

    if (
        browser_data["profileId"] != profile_id
        or browser_data["fontFamily"] != mapping["family_name"]
        or not browser_data["fontLoaded"]
    ):
        raise ValueError(f"{profile_id} browser verification used the wrong or unloaded font profile")
    tex_widths_px = [width * 96 / 72 for width in tex_widths_pt]
    differences = [
        browser - reference
        for browser, reference in zip(browser_data["browserWidths"], tex_widths_px)
    ]
    if len(differences) != len(cases):
        raise ValueError(f"{profile_id} browser and TFM case counts differ")
    maximum_error = max(abs(value) for value in differences)
    tolerance = samples["max_advance_error_px"]
    if maximum_error > tolerance:
        raise ValueError(
            f"{profile_id} advance mismatch: {maximum_error:.5f}px exceeds {tolerance:.5f}px"
        )

    left = Image.open(visual_reference).convert("RGBA")
    right = Image.open(browser_visual_png).convert("RGBA")
    comparison = Image.new("RGBA", (left.width + right.width + 16, max(left.height, right.height)), "white")
    comparison.alpha_composite(left, (0, 0))
    comparison.alpha_composite(right, (left.width + 16, 0))
    comparison.convert("RGB").save(comparison_path, optimize=False)

    result = {
        "status": "pass",
        "profile_id": profile_id,
        "display_name": profile["display_name"],
        "source_stem": source_stem,
        "font": font_path.relative_to(ROOT).as_posix(),
        "font_sha256": sha256(font_path),
        "tfm": tfm_path.relative_to(ROOT).as_posix(),
        "tfm_sha256": sha256(tfm_path),
        "ctan_archive_sha256": EXPECTED_ARCHIVE_SHA256,
        "browser": f"Chromium {browser_data['browserVersion']}",
        "node": browser_data["nodeVersion"],
        "playwright": browser_data["playwrightVersion"],
        "browser_font_family": mapping["family_name"],
        "opentype_features": sorted(features),
        "required_character_count": len(required),
        "unicode_coverage_count": len(cmap),
        "calibration": {
            "tfm_x_height_em": tfm_x_height_em,
            "outline_x_height_units": measured_x_height_units,
            "outline_x_height_em": measured_x_height_em,
            "outline_x_glyph_y_min_units": round(bounds_pen.bounds[1]),
            "space_advance_units": measured_space_units,
        },
        "cases": [
            {
                "text": text,
                "tex_advance_pt": tex_widths_pt[index],
                "tex_advance_px": tex_widths_px[index],
                "browser_advance_px": browser_data["browserWidths"][index],
                "difference_px": differences[index],
            }
            for index, text in enumerate(cases)
        ],
        "maximum_absolute_advance_error_px": maximum_error,
        "allowed_advance_error_px": tolerance,
        "visual_cases": samples["visual_cases"],
        "visual_glyph_cases": samples["visual_glyph_cases"],
        "visual_artifacts": [
            str(path.relative_to(ROOT))
            for path in (visual_reference, browser_visual_png, comparison_path)
        ],
    }
    report_path = reports / f"{report_prefix}-parity.json"
    report_path.write_text(
        json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    print(
        f"{profile_id} parity PASS: max advance error {maximum_error:.5f}px; "
        f"x-height {measured_x_height_em:.3f}em vs TFM {tfm_x_height_em:.3f}em"
    )
    print(f"Visual comparison: {comparison_path}")
    return result


def main() -> None:
    profiles = json.loads(PROFILES_PATH.read_text(encoding="utf-8"))["profiles"]
    families = []
    for profile in profiles:
        mapping = json.loads((HERE / "mappings" / f"{profile['source_stem']}.json").read_text(encoding="utf-8"))
        families.append(mapping["family_name"])
    if len(families) != len(set(families)):
        raise ValueError("Every CTAN profile must have a distinct browser family name")
    if sha256(ARCHIVE) != EXPECTED_ARCHIVE_SHA256:
        raise ValueError(f"Pinned CTAN archive hash mismatch: {ARCHIVE}")
    reports = HERE / "reports"
    reports.mkdir(parents=True, exist_ok=True)
    results = [verify_profile(profile, reports) for profile in profiles]
    manifest_path = reports / "font-profiles-parity.json"
    manifest_path.write_text(
        json.dumps(
            {
                "status": "pass",
                "ctan_archive_sha256": EXPECTED_ARCHIVE_SHA256,
                "profiles": [
                    {
                        "profile_id": result["profile_id"],
                        "report": f"reports/{result['profile_id']}-font-parity.json",
                        "font_sha256": result["font_sha256"],
                        "tfm_sha256": result["tfm_sha256"],
                        "maximum_absolute_advance_error_px": result[
                            "maximum_absolute_advance_error_px"
                        ],
                    }
                    for result in results
                ],
            },
            ensure_ascii=False,
            indent=2,
            sort_keys=True,
        )
        + "\n",
        encoding="utf-8",
    )
    print(f"All {len(results)} CTAN font profiles passed: {manifest_path}")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Measure and render the SAS prototype against the CTAN TFM reference."""

from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
import subprocess
import tempfile
import zipfile
from pathlib import Path, PurePosixPath

from PIL import Image
from fontTools.ttLib import TTFont

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
ARCHIVE = ROOT / "vendor/ctan/schulschriften/schulschriften-v5.zip"
GENERATED = HERE / "generated"
MAPPING_PATH = HERE / "mappings/wesa.json"
SAMPLES_PATH = HERE / "expected/sas-samples.json"
UPSTREAM_PREFIX = "schulschriften/source/wesa/"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def codepoint(value: str) -> int:
    return int(value.removeprefix("U+"), 16)


def tex_code(character: str, mapping: dict) -> int:
    value = ord(character)
    unicode_mapping = mapping["unicode_mapping"]
    first = codepoint(unicode_mapping["ascii_identity_range"]["start"])
    last = codepoint(unicode_mapping["ascii_identity_range"]["end"])
    if first <= value <= last:
        return value
    explicit = unicode_mapping["explicit_tfm_codes"]
    key = f"U+{value:04X}"
    if key in explicit:
        return explicit[key]
    raise ValueError(f"No TFM mapping for U+{value:04X}")


def tex_word(word: str, mapping: dict) -> str:
    return "".join("\\ " if character == " " else f"\\char{tex_code(character, mapping)}" for character in word)


def extract_wesa_sources(destination: Path) -> None:
    destination.mkdir(parents=True)
    with zipfile.ZipFile(ARCHIVE) as archive:
        for item in archive.infolist():
            if not item.filename.startswith(UPSTREAM_PREFIX) or not item.filename.endswith(".mf"):
                continue
            relative = PurePosixPath(item.filename).relative_to(UPSTREAM_PREFIX)
            target = destination.joinpath(*relative.parts)
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(archive.read(item))


def run_tex(
    tex_file: Path,
    working_dir: Path,
    generated_dir: Path,
    source_dir: Path,
    font_name: str = "wesa14",
) -> None:
    environment = os.environ.copy()
    environment["TEXFONTS"] = f"{generated_dir}//"
    environment["TFMFONTS"] = f"{generated_dir}//"
    resolved_tfm = subprocess.check_output(
        ["kpsewhich", "--format=tfm", f"{font_name}.tfm"], env=environment, text=True
    ).strip()
    if Path(resolved_tfm).resolve() != (generated_dir / f"{font_name}.tfm").resolve():
        raise RuntimeError(f"TeX resolved the wrong TFM file: {resolved_tfm}")
    environment["MFINPUTS"] = f"{source_dir}//"
    environment["TEXMFOUTPUT"] = str(working_dir)
    subprocess.run(
        ["tex", "-interaction=nonstopmode", "-halt-on-error", tex_file.name],
        cwd=working_dir,
        env=environment,
        check=True,
        capture_output=True,
        text=True,
    )


def measure_tex(
    cases: list[str],
    font_size: int,
    mapping: dict,
    work_dir: Path,
    source_dir: Path,
    font_name: str = "wesa14",
) -> list[float]:
    lines = [
        "\\nopagenumbers",
        f"\\font\\wesa={font_name} at {font_size}pt",
    ]
    for index, word in enumerate(cases):
        lines.extend(
            [
                f"\\setbox0=\\hbox{{\\wesa {tex_word(word, mapping)}}}",
                f"\\immediate\\write16{{SASWIDTH-{index}=\\the\\wd0}}",
            ]
        )
    lines.append("\\bye")
    tex_file = work_dir / "sas-widths.tex"
    tex_file.write_text("\n".join(lines) + "\n", encoding="ascii")
    run_tex(tex_file, work_dir, GENERATED, source_dir, font_name)
    log = (work_dir / "sas-widths.log").read_text(encoding="latin-1")
    widths = {
        int(index): float(value)
        for index, value in re.findall(r"SASWIDTH-(\d+)=([0-9.]+)pt", log)
    }
    if set(widths) != set(range(len(cases))):
        raise RuntimeError(f"Could not parse all TeX reference widths: {widths}")
    return [widths[index] for index in range(len(cases))]


def render_tex_reference(
    cases: list[str],
    font_size: int,
    mapping: dict,
    work_dir: Path,
    source_dir: Path,
    reports: Path,
    font_name: str = "wesa14",
    report_prefix: str = "sas",
) -> Path:
    page_width_pt = 500
    row_height_pt = 60
    top_padding_pt = 24
    page_height_pt = row_height_pt * len(cases) + top_padding_pt
    lines = [
        "\\nopagenumbers",
        "\\hoffset=-1in",
        "\\voffset=-1in",
        f"\\font\\wesa={font_name} at {font_size}pt",
        f"\\special{{papersize={page_width_pt}pt,{page_height_pt}pt}}",
        f"\\shipout\\vbox to {page_height_pt}pt{{",
        "\\offinterlineskip",
        f"\\vskip {top_padding_pt}pt",
    ]
    for word in cases:
        lines.extend(
            [
                f"  \\vbox to {row_height_pt}pt{{\\hbox{{\\hskip 18pt\\wesa {tex_word(word, mapping)}}}\\vfil}}",
            ]
        )
    lines.extend(["}", "\\bye"])
    tex_file = work_dir / f"{report_prefix}-visual.tex"
    tex_file.write_text("\n".join(lines) + "\n", encoding="ascii")
    run_tex(tex_file, work_dir, GENERATED, source_dir, font_name)

    dvi = work_dir / f"{report_prefix}-visual.dvi"
    postscript = reports / f"{report_prefix}-ctan-reference.ps"
    png = reports / f"{report_prefix}-ctan-reference.png"
    subprocess.run(
        ["dvips", "-q", "-o", str(postscript), str(dvi)],
        cwd=work_dir,
        env={**os.environ, "TEXFONTS": f"{GENERATED}//", "TFMFONTS": f"{GENERATED}//", "MFINPUTS": f"{source_dir}//"},
        check=True,
        capture_output=True,
        text=True,
    )
    subprocess.run(
        [
            "gs",
            "-q",
            "-dSAFER",
            "-dBATCH",
            "-dNOPAUSE",
            "-sDEVICE=pngalpha",
            "-r96",
            f"-sOutputFile={png}",
            str(postscript),
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    return png


def main() -> None:
    reports = HERE / "reports"
    reports.mkdir(parents=True, exist_ok=True)
    font_path = GENERATED / "sas-prototype.ttf"
    tfm_path = GENERATED / "wesa14.tfm"
    samples = json.loads(SAMPLES_PATH.read_text(encoding="utf-8"))
    mapping = json.loads(MAPPING_PATH.read_text(encoding="utf-8"))
    font = TTFont(font_path)
    cmap = {
        character
        for table in font["cmap"].tables
        if table.isUnicode()
        for character in table.cmap
    }
    features = {
        record.FeatureTag
        for table_tag in ("GSUB", "GPOS")
        for record in font[table_tag].table.FeatureList.FeatureRecord
    }
    required = {
        value
        for item in mapping["required_character_ranges"]
        for value in range(codepoint(item["start"]), codepoint(item["end"]) + 1)
    }
    if not required.issubset(cmap) or features != {"calt", "kern"}:
        raise RuntimeError("Generated SAS font failed cmap or OpenType feature validation")

    with tempfile.TemporaryDirectory(prefix="schulschriften-sas-verify-") as temporary:
        work_dir = Path(temporary)
        source_dir = work_dir / "source"
        extract_wesa_sources(source_dir)
        tex_widths_pt = measure_tex(
            samples["cases"], samples["tex_font_size_pt"], mapping, work_dir, source_dir
        )
        visual_reference = render_tex_reference(
            samples["visual_cases"] + samples["visual_glyph_cases"],
            samples["tex_font_size_pt"],
            mapping,
            work_dir,
            source_dir,
            reports,
        )

    browser_result_path = reports / "sas-browser-widths.json"
    browser_samples_png = reports / "sas-browser-samples.png"
    browser_visual_png = reports / "sas-browser-reference.png"
    environment = {
        **os.environ,
        "SAS_FONT_PATH": str(font_path),
        "SAS_FONT_FAMILY": mapping["family_name"],
        "SAS_PROFILE_ID": "sas",
        "SAS_SAMPLES_PATH": str(SAMPLES_PATH),
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
    tex_widths_px = [width * 96 / 72 for width in tex_widths_pt]
    differences = [
        browser - reference
        for browser, reference in zip(browser_data["browserWidths"], tex_widths_px)
    ]
    maximum_error = max(abs(value) for value in differences)
    if maximum_error > samples["max_advance_error_px"]:
        raise SystemExit(
            f"SAS advance mismatch: {maximum_error:.5f}px exceeds "
            f"{samples['max_advance_error_px']:.5f}px"
        )

    left = Image.open(visual_reference).convert("RGBA")
    right = Image.open(browser_visual_png).convert("RGBA")
    comparison = Image.new("RGBA", (left.width + right.width + 16, max(left.height, right.height)), "white")
    comparison.alpha_composite(left, (0, 0))
    comparison.alpha_composite(right, (left.width + 16, 0))
    comparison_path = reports / "sas-visual-comparison.png"
    comparison.convert("RGB").save(comparison_path, optimize=False)

    result = {
        "status": "pass",
        "font": "tools/fonts/schulschriften/generated/sas-prototype.ttf",
        "font_sha256": sha256(font_path),
        "tfm_sha256": sha256(tfm_path),
        "ctan_archive_sha256": "b33215791baec691dda5b1bac5a57cc50fadc931dc43c09759d77c0c404e72fc",
        "browser": f"Chromium {browser_data['browserVersion']}",
        "node": browser_data["nodeVersion"],
        "playwright": browser_data["playwrightVersion"],
        "browser_font_family": "Schreibatlas Schulschriften SAS",
        "opentype_features": sorted(features),
        "cases": [
            {
                "text": word,
                "tex_advance_pt": tex_widths_pt[index],
                "tex_advance_px": tex_widths_px[index],
                "browser_advance_px": browser_data["browserWidths"][index],
                "difference_px": differences[index],
            }
            for index, word in enumerate(samples["cases"])
        ],
        "maximum_absolute_advance_error_px": maximum_error,
        "allowed_advance_error_px": samples["max_advance_error_px"],
        "visual_cases": samples["visual_cases"],
        "visual_glyph_cases": samples["visual_glyph_cases"],
        "visual_artifacts": [
            str(path.relative_to(ROOT))
            for path in (visual_reference, browser_visual_png, comparison_path)
        ],
    }
    report_path = reports / "sas-parity.json"
    report_path.write_text(
        json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    print(
        f"SAS parity PASS: max advance error {maximum_error:.5f}px; "
        f"font sha256={result['font_sha256']}"
    )
    print(f"Visual comparison: {comparison_path}")


if __name__ == "__main__":
    main()

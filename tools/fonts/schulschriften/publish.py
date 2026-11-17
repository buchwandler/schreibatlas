#!/usr/bin/env python3
"""Publish generated Schulschriften prototypes and synchronize font records."""

from __future__ import annotations

import hashlib
import json
import re
import shutil
from fontTools.ttLib import TTFont
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
GENERATED = HERE / "generated"
PROFILES_PATH = HERE / "profiles.json"
PIPELINE_STEP = (
    "METAFONT standard-driver selection from profile metadata; source lookup restricted "
    "to the pinned CTAN archive; TFM and GF generation with mftrace"
)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()



def x_height_em(path: Path) -> float:
    font = TTFont(path)
    glyph_name = font.getBestCmap()[ord("x")]
    return round(font["glyf"][glyph_name].yMax / font["head"].unitsPerEm, 3)

def replace_section_value(text: str, section: str, field: str, value: str) -> str:
    section_match = re.search(
        rf"(?ms)^{re.escape(section)}:\n(.*?)(?=^[^ \t]|\Z)", text
    )
    if section_match is None:
        raise ValueError(f"Font record is missing {section}: section")
    section_text = section_match.group(1)
    updated, count = re.subn(
        rf"(?m)^(\s+{re.escape(field)}:\s*).*$",
        lambda match: f"{match.group(1)}{value}",
        section_text,
    )
    if count != 1:
        raise ValueError(f"Expected one {section}.{field} value, found {count}")
    return text[: section_match.start(1)] + updated + text[section_match.end(1) :]


def update_record(profile: dict) -> None:
    profile_id = profile["id"]
    font_id = "dn" if profile_id == "deutsche-normalschrift" else profile_id
    record_path = ROOT / "data" / "fonts" / f"schulschriften-{font_id}.yaml"
    record = record_path.read_text(encoding="utf-8")
    asset_match = re.search(r"(?m)^files: \[([^\]]+)\]$", record)
    if asset_match is None:
        raise ValueError(f"Could not determine canonical asset from {record_path}")
    asset_path = ROOT / asset_match.group(1)
    prototype_path = GENERATED / f"{profile_id}-prototype.ttf"
    tfm_path = GENERATED / f"{profile['source_driver']}.tfm"
    provenance_path = GENERATED / f"{profile_id}-prototype.provenance.json"
    if not prototype_path.is_file() or not tfm_path.is_file():
        raise FileNotFoundError(f"Generated font or TFM is missing for {profile_id}")
    provenance = json.loads(provenance_path.read_text(encoding="utf-8"))
    if (
        provenance["profile"]["source_driver"] != profile["source_driver"]
        or provenance["profile"]["source_shape"] != profile["source_shape"]
        or provenance["derivation"]["tfm_path"] != tfm_path.relative_to(ROOT).as_posix()
        or provenance["artifact"]["sha256"] != sha256(prototype_path)
    ):
        raise ValueError(f"Generated provenance does not match profile {profile_id}")

    asset_path.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(prototype_path, asset_path)
    record = replace_section_value(
        record, "upstream", "source_file", f"source/{profile['source_stem']}/{profile['source_driver']}.mf"
    )
    record = replace_section_value(
        record,
        "derivation",
        "tfm_file",
        f"tools/fonts/schulschriften/generated/{profile['source_driver']}.tfm",
    )
    record = replace_section_value(record, "derivation", "tfm_sha256", sha256(tfm_path))
    record = replace_section_value(record, "integrity", "sha256", sha256(asset_path))
    record = replace_section_value(record, "integrity", "bytes", str(asset_path.stat().st_size))
    record = replace_section_value(
        record, "calibration", "x_height_em", f"{x_height_em(prototype_path):.3f}"
    )
    record, count = re.subn(
        r"(?m)^([ \t]+- ).*source lookup.*$",
        lambda match: f'{match.group(1)}{PIPELINE_STEP}',
        record,
        count=1,
    )
    if count != 1:
        raise ValueError(f"Could not update derivation pipeline in {record_path}")
    record_path.write_text(record, encoding="utf-8")
    print(f"Published {profile_id}: {asset_path.relative_to(ROOT)} sha256={sha256(asset_path)}")


def main() -> None:
    profiles = json.loads(PROFILES_PATH.read_text(encoding="utf-8"))["profiles"]
    for profile in profiles:
        update_record(profile)


if __name__ == "__main__":
    main()

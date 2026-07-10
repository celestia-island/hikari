#!/usr/bin/env python3
"""Pack MDI icon data into a compressed binary archive (.dat).

This script reads SVG files from icons/mdi/ (populated by fetch_mdi_icons.py),
extracts viewBox and path data, serializes to a compact binary format,
and writes a gzip-compressed .dat file to packages/icons/resources/.

The .dat file is committed to git and shipped with the crate so that
build.rs can generate Rust code without needing network access or
local SVG files.

Binary format (per icon):
  [1 byte name_len] [name_len bytes name] [viewBox as 4xf32] [1 byte path_len_hi] [1 byte path_len_lo] [path bytes]

Usage:
    python3 scripts/icons/pack_mdi_data.py
    python3 scripts/icons/pack_mdi_data.py --icons-dir /path/to/icons/mdi
"""
from __future__ import annotations

import argparse
import gzip
import struct
import xml.etree.ElementTree as ET
from pathlib import Path

WORKSPACE_ROOT = Path(__file__).resolve().parent.parent.parent
DEFAULT_ICONS_DIR = WORKSPACE_ROOT / "icons" / "mdi"
DEFAULT_OUTPUT = WORKSPACE_ROOT / "packages" / "icons" / "resources" / "mdi_icons.dat"
MDI_MINIMAL_PATH = WORKSPACE_ROOT / "packages" / "icons" / "src" / "mdi_minimal.rs"

MAGIC = b"MDI1"


def parse_icon_names(mdi_minimal_path: Path) -> dict[str, str]:
    variants: dict[str, str] = {}
    in_display = False

    for line in mdi_minimal_path.read_text().splitlines():
        stripped = line.strip()
        if "impl std::fmt::Display for MdiIcon" in stripped:
            in_display = True
            continue
        if in_display:
            if stripped == "}" and "=>" not in stripped:
                in_display = False
                continue
            if "=>" in stripped and "write!" in stripped:
                variant = stripped.split("::")[1].split(" ")[0] if "::" in stripped else ""
                name_start = stripped.find('write!(f, "') + len('write!(f, "')
                name_end = stripped.find('")', name_start)
                kebab_name = stripped[name_start:name_end]
                if variant and kebab_name:
                    variants[variant] = kebab_name

    return variants


def parse_svg(svg_path: Path) -> tuple[list[float], str | None]:
    tree = ET.parse(str(svg_path))
    root = tree.getroot()
    vb_str = root.get("viewBox", "0 0 24 24")
    parts = vb_str.split()
    view_box = [float(p) for p in parts]
    path_el = root.find(".//{http://www.w3.org/2000/svg}path")
    path_d = path_el.get("d") if path_el is not None else None
    return view_box, path_d


def pack_icon(name: str, view_box: list[float], path_d: str) -> bytes:
    name_bytes = name.encode("utf-8")
    path_bytes = path_d.encode("utf-8")
    if len(name_bytes) > 255:
        raise ValueError(f"Icon name too long: {name}")
    if len(path_bytes) > 65535:
        raise ValueError(f"Path data too long for {name}")

    buf = bytearray()
    buf.append(len(name_bytes))
    buf.extend(name_bytes)
    buf.extend(struct.pack("<4f", *view_box))
    buf.extend(struct.pack("<H", len(path_bytes)))
    buf.extend(path_bytes)
    return bytes(buf)


def generate(variants: dict[str, str], icons_dir: Path, output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)

    found = 0
    missing: list[str] = []
    icon_entries: list[tuple[str, list[float], str]] = []

    for variant, kebab in sorted(variants.items()):
        svg_path = icons_dir / f"{kebab}.svg"
        if not svg_path.exists():
            missing.append(kebab)
            continue
        try:
            view_box, path_d = parse_svg(svg_path)
            if path_d is None:
                missing.append(kebab)
                continue
            icon_entries.append((kebab, view_box, path_d))
            found += 1
        except Exception as e:
            missing.append(f"{kebab} (parse error: {e})")

    raw = bytearray()
    raw.extend(MAGIC)
    raw.extend(struct.pack("<H", found))
    for name, vb, path_d in icon_entries:
        raw.extend(pack_icon(name, vb, path_d))

    compressed = gzip.compress(bytes(raw), compresslevel=9)
    output.write_bytes(compressed)

    print(f"  Packed {found} icons")
    print(f"  Raw size: {len(raw)} bytes")
    print(f"  Compressed: {len(compressed)} bytes ({len(compressed) / len(raw) * 100:.1f}%)")
    print(f"  Output: {output}")

    if missing:
        print(f"  Missing: {len(missing)}")
        for m in missing:
            print(f"    - {m}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Pack MDI icon data into compressed .dat")
    parser.add_argument("--icons-dir", type=Path, default=DEFAULT_ICONS_DIR)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()

    variants = parse_icon_names(MDI_MINIMAL_PATH)
    print(f"  Found {len(variants)} icon variants in mdi_minimal.rs")
    generate(variants, args.icons_dir, args.output)


if __name__ == "__main__":
    main()

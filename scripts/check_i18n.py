#!/usr/bin/env python3
"""Validate i18n completeness for BOTH JSON (Vue) and TOML (Rust) locale files.

Usage:
    python scripts/check_i18n_complete.py           # check both
    python scripts/check_i18n_complete.py --json    # JSON only
    python scripts/check_i18n_complete.py --toml    # TOML only
"""

import json
import sys
from pathlib import Path

try:
    import tomllib  # Python 3.11+
except ImportError:
    import toml as tomllib

ROOT = Path(__file__).resolve().parent.parent
LOCALES_DIR = ROOT / "res" / "i18n" / "locales"

ALL_LOCALES = ["en", "zhs", "zht", "ja", "ko", "de", "fr", "es", "pt", "ar", "ru"]


def collect_json_keys(path: Path) -> dict[str, str]:
    keys: dict[str, str] = {}
    for jf in sorted(path.glob("*.json")):
        with open(jf) as f:
            data = json.load(f)
        _flatten(data, "", keys)
    return keys


def collect_toml_keys(path: Path) -> dict[str, str]:
    keys: dict[str, str] = {}
    for tf in sorted(path.glob("*.toml")):
        with open(tf, "rb") as f:
            data = tomllib.load(f)
        _flatten(data, "", keys)
    return keys


def _flatten(data: dict, prefix: str, out: dict):
    for k, v in data.items():
        key = f"{prefix}{k}" if prefix else k
        if isinstance(v, dict):
            _flatten(v, f"{key}.", out)
        elif isinstance(v, str):
            out[key] = v


def check(ext: str, collect_fn) -> bool:
    print(f"\n=== {ext.upper()} locales ===")
    en_keys = collect_fn(LOCALES_DIR / "en")
    ok = True

    for loc in ALL_LOCALES:
        if loc == "en":
            continue
        loc_dir = LOCALES_DIR / loc
        if not loc_dir.is_dir():
            continue
        loc_keys = collect_fn(loc_dir)
        missing = set(en_keys) - set(loc_keys)
        extra = set(loc_keys) - set(en_keys)
        for m in sorted(missing):
            print(f"ERROR [{loc}]: missing key: {m}")
            ok = False
        for m in sorted(extra):
            print(f"WARN  [{loc}]: extra key: {m}")
        for key, val in loc_keys.items():
            if not val:
                print(f"WARN  [{loc}]: empty value: {key}")

    if ok:
        print(f"OK: All locales consistent ({len(en_keys)} keys)")
    return ok


def main():
    json_only = "--json" in sys.argv
    toml_only = "--toml" in sys.argv
    all_ok = True

    if not toml_only:
        if not check("json", collect_json_keys):
            all_ok = False
    if not json_only:
        if not check("toml", collect_toml_keys):
            all_ok = False

    sys.exit(0 if all_ok else 1)


if __name__ == "__main__":
    main()

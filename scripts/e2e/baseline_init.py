#!/usr/bin/env python3
"""
Baseline initializer for visual regression tests.

Generates placeholder baseline entries for all routes defined in the
full_component_coverage.json test suite. Run with a live dev server to
capture actual screenshots.

Usage:
    # With live server (captures real screenshots):
    python scripts/e2e/baseline_init.py --url http://localhost:3000 --debug-port 3001

    # Dry-run (just creates directory structure):
    python scripts/e2e/baseline_init.py --dry-run
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
SUITE_PATH = REPO_ROOT / "tests" / "visual" / "full_component_coverage.json"
BASELINE_DIR = REPO_ROOT / "tests" / "visual" / "baseline" / "default"


def load_suite() -> dict:
    with open(SUITE_PATH) as f:
        return json.load(f)


def init_dirs(suite: dict) -> list[str]:
    baselines = []
    for test in suite.get("tests", []):
        bl = test.get("expected_baseline", "")
        if bl:
            baselines.append(bl)
    return baselines


def capture_live(baselines: list[str], base_url: str, debug_port: int, wait: int):
    _pkg = str(Path(__file__).parent)
    if _pkg not in sys.path:
        sys.path.insert(0, _pkg)
    from browser import TairitsuBrowser

    browser = TairitsuBrowser(debug_port=debug_port)
    health = browser.health()
    if not health.get("success"):
        print("ERROR: Cannot connect to tairitsu-debug server")
        print("Start with: just dev --daemon")
        return False

    suite = load_suite()
    route_map = {}
    for test in suite.get("tests", []):
        bl = test.get("expected_baseline", "")
        if bl:
            route_map[bl] = test.get("route", "/")

    BASELINE_DIR.mkdir(parents=True, exist_ok=True)
    ok = 0
    fail = 0
    for bl_name in baselines:
        route = route_map.get(bl_name, "/")
        out_path = str(BASELINE_DIR / bl_name)
        print(f"  Capturing {bl_name} ({route})...", end=" ", flush=True)
        res = browser.capture_and_save(route, out_path, base_url, wait_ms=wait)
        if res.get("success"):
            sz = res.get("size_bytes", 0)
            print(f"OK ({sz} bytes)")
            ok += 1
        else:
            err = res.get("error", "unknown")
            print(f"FAIL ({err})")
            fail += 1

    print(f"\nCaptured {ok}/{ok + fail} baselines")
    return fail == 0


def main():
    parser = argparse.ArgumentParser(description="Initialize visual regression baselines")
    parser.add_argument("--url", default="http://localhost:3000", help="Base URL of dev server")
    parser.add_argument("--debug-port", type=int, default=3001, help="Tairitsu debug port")
    parser.add_argument("--wait", type=int, default=6, help="Wait seconds per page")
    parser.add_argument("--dry-run", action="store_true", help="Only list baselines, don't capture")
    args = parser.parse_args()

    suite = load_suite()
    baselines = init_dirs(suite)
    print(f"Test suite: {suite.get('name', 'unknown')}")
    print(f"Total baselines needed: {len(baselines)}")

    if args.dry_run:
        existing = {p.name for p in BASELINE_DIR.glob("*.png")} if BASELINE_DIR.exists() else set()
        missing = [b for b in baselines if b not in existing]
        print(f"Already exist: {len(existing & set(baselines))}")
        print(f"Missing: {len(missing)}")
        for m in sorted(missing):
            print(f"  - {m}")
        return 0

    BASELINE_DIR.mkdir(parents=True, exist_ok=True)
    success = capture_live(baselines, args.url, args.debug_port, args.wait * 1000)
    return 0 if success else 1


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
"""Capture screenshots via tairitsu debug API.

Requires: tairitsu dev --debug running (just dev --debug)
"""
from __future__ import annotations

import argparse
import base64
import json
import shutil
import sys
import time
from pathlib import Path

try:
    import requests
except ImportError:
    print("ERROR: 'requests' not installed. Run: pip install requests", file=sys.stderr)
    sys.exit(1)

ROUTES = [
    ("/", "home", True),
    ("/components/", "components_overview", True),
    ("/components/layer1/", "components_layer1", False),
    ("/components/layer2/", "components_layer2", False),
    ("/components/layer3/", "components_layer3", False),
    ("/components/layer1/button/index.html", "button", True),
    ("/components/layer1/form/index.html", "form_input", True),
    ("/components/layer1/switch/index.html", "switch", True),
    ("/components/layer1/avatar/index.html", "avatar", True),
    ("/components/layer1/tag/index.html", "tag", False),
    ("/components/layer1/search/index.html", "search", False),
    ("/components/layer1/empty/index.html", "empty", False),
    ("/components/layer1/feedback/index.html", "feedback", True),
    ("/components/layer2/table/index.html", "table", True),
    ("/components/layer2/navigation/index.html", "navigation", True),
    ("/components/layer2/timeline/index.html", "timeline", False),
    ("/components/layer2/form/index.html", "form_layer2", True),
    ("/components/layer3/editor/index.html", "editor", True),
    ("/components/layer3/media/index.html", "media", True),
    ("/components/layer3/user-guide/index.html", "user_guide", True),
    ("/components/layer3/visualization/index.html", "visualization", True),
    ("/system/palette/index.html", "palette", True),
    ("/system/icons/index.html", "icons", True),
    ("/system/css/index.html", "css_utilities", False),
    ("/system/i18n/index.html", "i18n", False),
    ("/system/animations/index.html", "animations_system", False),
    ("/animations/index.html", "animations_demo", True),
    ("/interactive/index.html", "interactive", True),
    ("/demos/dashboard/index.html", "dashboard", True),
]


def capture_one(session, debug_url, site_url, route, name, full_page, output_dir, wait):
    out_path = output_dir / f"{name}.png"

    try:
        r = session.post(f"{debug_url}/navigate", json={"url": f"{site_url}{route}"}, timeout=30)
        r.raise_for_status()
    except Exception:
        return False, f"{name}: navigate failed"

    time.sleep(wait)

    try:
        r = session.post(f"{debug_url}/screenshot", json={"full_page": full_page}, timeout=60)
        r.raise_for_status()
        data = r.json()
    except Exception:
        return False, f"{name}: screenshot failed"

    b64 = data.get("data", {}).get("data", "") if isinstance(data, dict) else ""
    if not b64:
        return False, f"{name}: no screenshot data"

    img = base64.b64decode(b64)
    out_path.write_bytes(img)
    print(f"  ✓ {route:<45} -> {name}.png ({len(img)} bytes)")
    return True, ""


def main():
    ap = argparse.ArgumentParser(description="Capture screenshots via tairitsu debug API")
    ap.add_argument("--debug-url", default="http://localhost:3001")
    ap.add_argument("--site-url", default="http://localhost:3000")
    ap.add_argument("--output", default="target/screenshots")
    ap.add_argument("--wait", type=float, default=3)
    args = ap.parse_args()

    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)

    try:
        r = requests.get(f"{args.debug_url}/health", timeout=5)
        r.raise_for_status()
    except Exception:
        print(f"Error: Debug API not running at {args.debug_url}", file=sys.stderr)
        print("Start with: just dev-debug", file=sys.stderr)
        sys.exit(1)

    s = requests.Session()
    captured = 0
    failed = 0

    for route, name, fp in ROUTES:
        ok, msg = capture_one(s, args.debug_url, args.site_url, route, name, fp, output_dir, args.wait)
        if ok:
            captured += 1
        else:
            print(f"  ✗ {msg}")
            failed += 1

    print(f"\nCaptured: {captured}/{captured + failed}")


if __name__ == "__main__":
    main()

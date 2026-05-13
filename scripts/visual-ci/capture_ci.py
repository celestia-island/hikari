#!/usr/bin/env python3
"""
Visual Regression CI — Screenshot Capture

Playwright-based screenshot capture for CI environments.
Captures key routes of the Hikari website for visual regression testing.

Usage:
    python3 capture_ci.py --url http://localhost:3000 --output ./screenshots
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path

try:
    from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout
    PLAYWRIGHT_AVAILABLE = True
except ImportError:
    PLAYWRIGHT_AVAILABLE = False

DEFAULT_URL = "http://localhost:3000"
VIEWPORT = {"width": 1920, "height": 1080}
BASELINE_ROUTES: list[dict] = [
    {"route": "/", "name": "home", "full_page": True},
    {"route": "/components/", "name": "components_overview", "full_page": True},
    {"route": "/components/layer1/", "name": "components_layer1", "full_page": False},
    {"route": "/components/layer2/", "name": "components_layer2", "full_page": False},
    {"route": "/components/layer3/", "name": "components_layer3", "full_page": False},
    {"route": "/components/layer1/button/index.html", "name": "button", "full_page": True},
    {"route": "/components/layer1/form/index.html", "name": "form_input", "full_page": True},
    {"route": "/components/layer1/switch/index.html", "name": "switch", "full_page": True},
    {"route": "/components/layer1/avatar/index.html", "name": "avatar", "full_page": True},
    {"route": "/components/layer1/tag/index.html", "name": "tag", "full_page": False},
    {"route": "/components/layer1/search/index.html", "name": "search", "full_page": False},
    {"route": "/components/layer1/empty/index.html", "name": "empty", "full_page": False},
    {"route": "/components/layer1/feedback/index.html", "name": "feedback", "full_page": True},
    {"route": "/components/layer2/table/index.html", "name": "table", "full_page": True},
    {"route": "/components/layer2/navigation/index.html", "name": "navigation", "full_page": True},
    {"route": "/components/layer2/timeline/index.html", "name": "timeline", "full_page": False},
    {"route": "/components/layer2/form/index.html", "name": "form_layer2", "full_page": True},
    {"route": "/components/layer3/editor/index.html", "name": "editor", "full_page": True},
    {"route": "/components/layer3/media/index.html", "name": "media", "full_page": True},
    {"route": "/components/layer3/user-guide/index.html", "name": "user_guide", "full_page": True},
    {"route": "/components/layer3/visualization/index.html", "name": "visualization", "full_page": True},
    {"route": "/system/palette/index.html", "name": "palette", "full_page": True},
    {"route": "/system/icons/index.html", "name": "icons", "full_page": True},
    {"route": "/system/css/index.html", "name": "css_utilities", "full_page": False},
    {"route": "/system/i18n/index.html", "name": "i18n", "full_page": False},
    {"route": "/system/animations/index.html", "name": "animations_system", "full_page": False},
    {"route": "/animations/index.html", "name": "animations_demo", "full_page": True},
    {"route": "/interactive/index.html", "name": "interactive", "full_page": True},
    {"route": "/demos/dashboard/index.html", "name": "dashboard", "full_page": True},
]


def capture_routes(
    base_url: str,
    output_dir: str,
    wait_seconds: int = 10,
    routes: list[dict] | None = None,
) -> dict:
    """Capture screenshots for all configured routes."""
    if not PLAYWRIGHT_AVAILABLE:
        return {
            "success": False,
            "error": "Playwright not installed. Run: pip install playwright && playwright install chromium",
        }

    out = Path(output_dir)
    out.mkdir(parents=True, exist_ok=True)
    route_list = routes or BASELINE_ROUTES

    results = {}
    captured = 0
    failed = 0

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport=VIEWPORT)

        for item in route_list:
            route = item["route"]
            name = item["name"]
            full_page = item.get("full_page", True)

            url = f"{base_url}{route}" if route.startswith("/") else f"{base_url}/{route}"
            out_path = str(out / f"{name}.png")

            try:
                page.goto(url, wait_until="networkidle", timeout=wait_seconds * 1000)
                time.sleep(2)
                page.screenshot(path=out_path, full_page=full_page)

                size = os.path.getsize(out_path)
                results[name] = {
                    "route": route,
                    "path": out_path,
                    "size_bytes": size,
                    "success": True,
                }
                captured += 1
                print(f"  \u2713 {route} -> {name}.png ({size} bytes)")

            except PWTimeout:
                print(f"  \u2717 {route} -> timeout, skipping")
                results[name] = {"route": route, "success": False, "error": "timeout"}
                failed += 1
            except Exception as e:
                print(f"  \u2717 {route} -> {e}")
                results[name] = {"route": route, "success": False, "error": str(e)}
                failed += 1

        browser.close()

    report_path = str(out / "capture_report.json")
    with open(report_path, "w") as f:
        json.dump({
            "total": len(route_list),
            "captured": captured,
            "failed": failed,
            "output_dir": str(out),
            "results": results,
        }, f, indent=2)

    return {
        "success": failed == 0,
        "total": len(route_list),
        "captured": captured,
        "failed": failed,
        "output_dir": str(out),
        "report": report_path,
        "results": results,
    }


def main():
    parser = argparse.ArgumentParser(
        description="CI Screenshot Capture for Visual Regression",
    )
    parser.add_argument("--url", default=DEFAULT_URL, help="Base URL of the website")
    parser.add_argument("--output", "-o", default="./screenshots", help="Output directory")
    parser.add_argument("--wait", type=int, default=10, help="Wait seconds per page")
    parser.add_argument("--routes", help="Comma-separated route names to capture (default: all)")
    args = parser.parse_args()

    routes = None
    if args.routes:
        names = set(args.routes.split(","))
        routes = [r for r in BASELINE_ROUTES if r["name"] in names]

    result = capture_routes(args.url, args.output, args.wait, routes)

    print(f"\nCaptured {result['captured']}/{result['total']} screenshots -> {args.output}")
    if result["report"]:
        print(f"Report: {result['report']}")
    return 0 if result["success"] else 1


if __name__ == "__main__":
    sys.exit(main())

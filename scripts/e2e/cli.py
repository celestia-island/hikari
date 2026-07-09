#!/usr/bin/env python3
"""
Hikari E2E Framework - CLI Entry Point

Replaces the Rust-based hikari-e2e package with a pure Python framework
that uses tairitsu-debug HTTP API for browser automation and includes
screenshot comparison, baseline management, and test suite execution.

Subcommands:
  capture     - Capture screenshots for routes (replaces hikari-visual-debug/hikari-screenshot)
  batch       - Batch capture all routes with report (replaces visual-batch)
  inspect     - Inspect a single page (layout, errors, console)
  compare     - Compare two screenshots or run regression against baselines
  baseline    - Manage golden/baseline screenshots (init, accept, list, delete)
  run         - Execute a JSON test suite (replaces main hikari-e2e binary)
  health      - Check tairitsu-debug server status
  interactive - Run a sequence of actions from a JSON file

Usage:
  python scripts/e2e/cli.py capture --route / --output home.png
  python scripts/e2e/cli.py batch --url http://localhost:3000 --output ./screenshots
  python scripts/e2e/cli.py run tests/visual_quality.json
  python scripts/e2e/cli.py baseline accept home candidate.png
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

_pkg_dir = str(Path(__file__).parent)
if _pkg_dir not in sys.path:
    sys.path.insert(0, _pkg_dir)

try:
    from .browser import TairitsuBrowser
    from .compare import ScreenshotComparator
    from .baseline import BaselineManager
    from .runner import E2ERunner
    from .report import ReportGenerator
except ImportError:
    from browser import TairitsuBrowser
    from compare import ScreenshotComparator
    from baseline import BaselineManager
    from runner import E2ERunner
    from report import ReportGenerator

DEFAULT_ROUTES = [
    "/",
    "/components",
    "/components/layer1",
    "/components/layer2",
    "/components/layer3",
    "/button",
    "/input",
    "/card",
    "/table",
    "/switch",
    "/palette",
    "/navigation",
    "/guides/getting-started",
]


def cmd_health(args):
    """Check tairitsu-debug server health."""
    browser = TairitsuBrowser(debug_port=args.debug_port)
    health = browser.health()
    info = browser.info() if health.get("success") else {}
    print(json.dumps({"health": health, "info": info}, indent=2))
    return 0 if health.get("success") else 1


def cmd_capture(args):
    """Capture a single page screenshot."""
    browser = TairitsuBrowser(debug_port=args.debug_port)

    if not args.route and not args.url:
        print("ERROR: --route or --url is required", file=sys.stderr)
        return 1

    output = args.output or (
        f"{args.route.strip('/').replace('/', '_') or 'home'}.png"
    )

    result = browser.capture_and_save(
        route=args.route or "/",
        output_path=output,
        base_url="http://localhost:3000",
        wait_ms=args.wait * 1000,
        full_page=not args.no_full_page,
    )

    if result.get("success"):
        size = result.get("size_bytes", 0)
        saved = result.get("saved_to", output)
        print(f"OK: {saved} ({size} bytes)")
        return 0
    else:
        print(f"ERROR: {result.get('error', 'Unknown error')}", file=sys.stderr)
        return 1


def cmd_batch(args):
    """Batch capture all routes."""
    out = Path(args.output)
    out.mkdir(parents=True, exist_ok=True)

    routes = args.routes.split(",") if args.routes else DEFAULT_ROUTES
    runner = E2ERunner(debug_port=args.debug_port, output_dir=str(out))

    result = runner.run_batch_capture(
        routes=routes,
        base_url=args.url,
        output_dir=str(out),
        wait_ms=args.wait * 1000,
        full_page=not args.no_full_page,
    )

    if args.report:
        report_path = str(out / "report.json")
        with open(report_path, "w") as f:
            json.dump(result, f, indent=2)
        print(f"Report: {report_path}")

    captured = result.get("captured", 0)
    total = result.get("total", 0)
    print(f"\nCaptured {captured}/{total} screenshots -> {out}")
    return 0 if captured == total else 1


def cmd_inspect(args):
    """Inspect a single page: screenshot + diagnostics."""
    browser = TairitsuBrowser(debug_port=args.debug_port)
    route = args.route or "/"
    url = f"http://localhost:3000{route}"
    output = args.output or "inspect.png"

    nav = browser.navigate_route(wait_ms=args.wait * 1000, route=route)
    time.sleep(1)

    ss = browser.screenshot(output_path=output, full_page=not args.no_full_page)
    snap = browser.snapshot()
    errs = browser.errors()
    con = browser.console_messages(level="error")
    info = browser.info()

    report = {
        "route": route,
        "url": url,
        "navigation": nav,
        "screenshot": {
            "path": ss.get("saved_to", output),
            "size": ss.get("size_bytes", 0),
        },
        "server_info": info,
        "page_errors": errs,
        "console_errors": con,
        "snapshot_preview": (
            str(snap)[:2000] if isinstance(snap, str) else str(snap)[:2000]
        ),
    }

    if args.json:
        print(json.dumps(report, indent=2))
    else:
        print(f"\n{'='*50}")
        print(f" Inspect: {route}")
        print(f"{'='*50}")
        print(f" Screenshot: {ss.get('saved_to', 'N/A')} ({ss.get('size_bytes', 0)} bytes)")
        print(f" Nav OK:    {nav.get('success', False)}")
        err_list = errs.get("errors", []) if isinstance(errs, dict) else []
        con_list = con.get("messages", []) if isinstance(con, dict) else []
        print(f" Errors:    {len(err_list)}")
        print(f" Console:   {len(con_list)} errors/warnings")

        if err_list:
            print("\n Page Errors:")
            for e in err_list[:10]:
                print(f"   - {e}")

    return 0


def cmd_compare(args):
    """Compare two screenshots or run regression against baselines."""
    comparator = ScreenshotComparator(
        pixel_threshold=args.threshold,
        max_diff_ratio=args.max_diff_ratio,
    )

    if args.baseline_dir:
        mgr = BaselineManager(args.baseline_dir, args.suite or "default")
        pairs = mgr.get_all_pairs(args.candidate_dir)
        if not pairs:
            print("No matching baseline/candidate pairs found.", file=sys.stderr)
            return 1
        result = comparator.batch_compare(pairs, args.output or ".")
        print(json.dumps(result, indent=2))
        return 0 if result["all_passed"] else 2

    elif args.expected and args.actual:
        diff_out = args.output or "diff.png"
        result = comparator.compare(args.expected, args.actual, diff_out)
        print(result.summary)
        if args.json:
            print(json.dumps({
                "identical": result.identical,
                "passed": result.passed,
                "diff_pct": round(result.diff_percentage, 2),
                "diff_pixels": result.different_pixels,
                "total_pixels": result.total_pixels,
                "mean_diff": round(result.mean_diff, 1),
                "max_diff": round(result.max_diff, 1),
                "regions": len(result.regions),
                "diff_image": result.diff_image_path,
                "error": result.error,
            }, indent=2))
        return 0 if result.passed else 2

    else:
        print("ERROR: Provide --expected + --actual OR --baseline-dir + --candidate-dir",
              file=sys.stderr)
        return 1


def cmd_baseline(args):
    """Manage golden/baseline screenshots."""
    mgr = BaselineManager(
        base_dir=args.base_dir or "baselines",
        suite_name=args.suite or "default",
    )

    action = args.action

    if action == "init":
        mgr.init()
        print(f"Initialized baseline dir: {mgr.suite_dir}")

    elif action == "set":
        meta = mgr.set_baseline(
            name=args.name,
            image_path=args.image,
            route=args.route or args.name,
            viewport=f"{args.width}x{args.height}",
            full_page=not args.viewport_only,
        )
        print(f"Baseline set: {args.name} -> {meta.sha256[:12]}... ({meta.file_size} bytes)")

    elif action == "accept":
        meta = mgr.accept_candidate(
            name=args.name,
            candidate_path=args.image,
            route=args.route or args.name,
        )
        print(f"Accepted: {args.name} -> new baseline updated")

    elif action == "list":
        items = mgr.list_baselines()
        if not items:
            print("No baselines found.")
            return 0
        print(f"\nBaselines ({len(items)}):")
        print(f"{'Name':<30} {'Route':<25} {'Size':>8} {'Updated'}")
        print("-" * 80)
        for item in items:
            print(
                f"{item['name']:<30} {item['route']:<25} "
                f"{item['file_size']:>8} {item['updated_at'][:16]}"
            )

    elif action == "delete":
        if mgr.delete_baseline(args.name):
            print(f"Deleted baseline: {args.name}")
        else:
            print(f"Baseline not found: {args.name}", file=sys.stderr)
            return 1

    elif action == "export":
        manifest = mgr.export_manifest(args.output or "baseline_manifest.json")
        print(f"Exported {manifest['total']} baselines -> {args.output}")

    else:
        print(f"Unknown baseline action: {action}", file=sys.stderr)
        return 1

    return 0


def cmd_run(args):
    """Execute a JSON test suite."""
    runner = E2ERunner(
        debug_port=args.debug_port,
        base_url=args.url,
        output_dir=args.output or "e2e_output",
        baseline_dir=args.baseline_dir or "baselines",
    )
    result = runner.run_suite(args.suite)

    reporter = ReportGenerator(output_dir=result.output_dir if hasattr(result, 'output_dir') else args.output or "e2e_output")
    reporter.print_summary(result)

    json_path = reporter.generate_json(result) if not args.no_report else None
    html_path = reporter.generate_html(result) if args.html and not args.no_report else None

    if json_path:
        print(f"JSON report: {json_path}")
    if html_path:
        print(f"HTML report: {html_path}")

    return 0 if result.failed == 0 else 1


def cmd_interactive(args):
    """Run an interactive session from a JSON commands file."""
    browser = TairitsuBrowser(debug_port=args.debug_port)
    out = args.output_dir or "."

    with open(args.input) as f:
        actions = json.load(f)

    results = browser.interactive_session(actions, base_url=args.url, output_dir=out)

    if args.json_output:
        with open(args.json_output, "w") as f:
            json.dump(results, f, indent=2)

    ok = sum(1 for r in results if r.get("success"))
    total = len(results)
    print(f"\nInteractive session: {ok}/{total} steps succeeded")
    return 0 if ok == total else 1


def main():
    parser = argparse.ArgumentParser(
        prog="hikari-e2e",
        description="Hikari E2E Testing Framework (Python, powered by Tairitsu MCP)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s health                          Check if tairitsu-debug is running
  %(prog)s capture --route /               Screenshot home page
  %(prog)s batch --output ./shots          Batch capture all routes
  %(prog)s inspect --route / --json        Full page inspection as JSON
  %(prog)s compare --expected a.png --actual b.png   Compare two images
  %(prog)s baseline init                   Initialize baseline directory
  %(prog)s baseline set home home.png      Set golden screenshot
  %(prog)s baseline accept home new.png    Promote candidate to golden
  %(prog)s run tests/visual_quality.json   Execute test suite
  %(prog)s interactive --input cmds.json   Run command sequence
""",
    )
    parser.add_argument(
        "--debug-port", type=int, default=3001,
        help="Tairitsu-debug HTTP API port (default: 3001)",
    )
    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    # health
    p_health = subparsers.add_parser("health", help="Check server status")

    # capture
    p_cap = subparsers.add_parser("capture", help="Capture a single screenshot")
    p_cap.add_argument("--route", default="", help="Route to capture (e.g. /, /components)")
    p_cap.add_argument("--url", help="Full URL to capture")
    p_cap.add_argument("--output", "-o", help="Output file path")
    p_cap.add_argument("--wait", type=int, default=8, help="Wait seconds before capture (default: 8)")
    p_cap.add_argument("--no-full-page", action="store_true", help="Viewport-only screenshot")

    # batch
    p_batch = subparsers.add_parser("batch", help="Batch capture multiple routes")
    p_batch.add_argument("--url", default="http://localhost:3000", help="Base URL")
    p_batch.add_argument("--output", "-o", default="./screenshots", help="Output directory")
    p_batch.add_argument("--routes", help="Comma-separated routes (default: all known routes)")
    p_batch.add_argument("--wait", type=int, default=8, help="Wait seconds per page")
    p_batch.add_argument("--no-full-page", action="store_true")
    p_batch.add_argument("--report", help="Save batch report to this path")

    # inspect
    p_inspect = subparsers.add_parser("inspect", help="Inspect a single page")
    p_inspect.add_argument("--route", default="/", help="Route to inspect")
    p_inspect.add_argument("--output", "-o", default="inspect.png", help="Screenshot output")
    p_inspect.add_argument("--wait", type=int, default=8)
    p_inspect.add_argument("--no-full-page", action="store_true")
    p_inspect.add_argument("--json", action="store_true", help="JSON output")

    # compare
    p_cmp = subparsers.add_parser("compare", help="Compare screenshots")
    p_cmp.add_argument("--expected", help="Baseline/golden image path")
    p_cmp.add_argument("--actual", help="Candidate/new image path")
    p_cmp.add_argument("--baseline-dir", help="Baseline directory for batch comparison")
    p_cmp.add_argument("--candidate-dir", help="Candidate directory for batch comparison")
    p_cmp.add_argument("--suite", help="Suite name for baseline lookup")
    p_cmp.add_argument("--output", "-o", help="Diff image output path")
    p_cmp.add_argument("--threshold", type=int, default=30, help="Pixel threshold (0-255)")
    p_cmp.add_argument("--max-diff-ratio", type=float, default=0.01, help="Max allowed diff ratio")
    p_cmp.add_argument("--json", action="store_true", help="JSON output")

    # baseline
    p_bl = subparsers.add_parser("baseline", help="Manage golden screenshots")
    p_bl.add_argument("action", choices=["init", "set", "accept", "list", "delete", "export"],
                      help="Action to perform")
    p_bl.add_argument("--name", help="Baseline name")
    p_bl.add_argument("--image", help="Image file path")
    p_bl.add_argument("--route", help="Associated route")
    p_bl.add_argument("--base-dir", dest="base_dir", help="Base directory for baselines")
    p_bl.add_argument("--suite", help="Suite name (subdirectory)")
    p_bl.add_argument("--width", type=int, default=1920, help="Viewport width")
    p_bl.add_argument("--height", type=int, default=1080, help="Viewport height")
    p_bl.add_argument("--viewport-only", action="store_true")
    p_bl.add_argument("--output", "-o", help="Output path (for export)")

    # run
    p_run = subparsers.add_parser("run", help="Execute a test suite")
    p_run.add_argument("suite", help="Path to test suite JSON file")
    p_run.add_argument("--url", default="http://localhost:3000", help="Base URL")
    p_run.add_argument("--output", "-o", help="Output directory")
    p_run.add_argument("--baseline-dir", help="Baseline directory")
    p_run.add_argument("--no-report", action="store_true", help="Skip report generation")
    p_run.add_argument("--html", action="store_true", help="Also generate HTML report")

    # interactive
    p_inter = subparsers.add_parser("interactive", help="Run command sequence from JSON")
    p_inter.add_argument("--input", "-i", required=True, help="Commands JSON file")
    p_inter.add_argument("--url", default="http://localhost:3000")
    p_inter.add_argument("--output-dir", "-o", default=".")
    p_inter.add_argument("--json-output", help="Save results JSON here")

    args = parser.parse_args()

    dispatch = {
        "health": cmd_health,
        "capture": cmd_capture,
        "batch": cmd_batch,
        "inspect": cmd_inspect,
        "compare": cmd_compare,
        "baseline": cmd_baseline,
        "run": cmd_run,
        "interactive": cmd_interactive,
    }

    fn = dispatch.get(args.command)
    if fn is None:
        parser.print_help()
        return 1
    return fn(args)


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
"""
Hikari Browser Debug Helper

Provides convenient interface for AI agents to debug and analyze UI components.
Uses the Tairitsu-debug HTTP API (port 3001) via the Python E2E framework,
replacing the old Rust-based hikari-browser-debug binary.
"""

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Optional

_e2e_dir = str(Path(__file__).parent.parent / "e2e")
if _e2e_dir not in sys.path:
    sys.path.insert(0, _e2e_dir)

from browser import TairitsuBrowser

SCREENSHOT_DIR = Path("scripts/dev/screenshots")
COMMANDS_DIR = Path("scripts/dev/commands")
DEFAULT_PORT = int(os.environ.get("TAIRITSU_DEBUG_PORT", "3001"))


def ensure_dirs():
    SCREENSHOT_DIR.mkdir(exist_ok=True)
    COMMANDS_DIR.mkdir(exist_ok=True)


def get_browser(port: int = DEFAULT_PORT) -> TairitsuBrowser:
    return TairitsuBrowser(debug_port=port)


def screenshot(
    url: str = "http://localhost:3000",
    output: str = "screenshot.png",
    wait: int = 10,
    inject: Optional[str] = None,
    full_page: bool = True,
    port: int = DEFAULT_PORT,
) -> dict:
    ensure_dirs()
    output_path = SCREENSHOT_DIR / output
    browser = get_browser(port)

    route = url.replace("http://localhost:3000", "") or "/"
    result = browser.capture_and_save(
        route=route,
        output_path=str(output_path),
        wait_ms=wait * 1000,
        full_page=full_page,
    )

    if inject and result.get("success"):
        browser.evaluate(inject)

    return {
        "success": result.get("success", False),
        "output": str(output_path),
        "size_bytes": result.get("size_bytes", 0),
        "error": result.get("error"),
    }


def check(url: str = "http://localhost:3000", wait: int = 10, port: int = DEFAULT_PORT) -> dict:
    browser = get_browser(port)
    route = url.replace("http://localhost:3000", "") or "/"
    nav = browser.navigate_route(wait_ms=wait * 1000, route=route)
    errs = browser.errors()
    con = browser.console_messages(level="error")

    err_list = errs.get("errors", []) if isinstance(errs, dict) else []
    con_list = con.get("messages", []) if isinstance(con, dict) else []

    return {
        "success": nav.get("success", False) and len(err_list) == 0 and len(con_list) == 0,
        "navigation": nav.get("success"),
        "page_errors": len(err_list),
        "console_errors": len(con_list),
        "errors": err_list[:10],
        "console": con_list[:10],
    }


def execute_script(url: str, script: str, wait: int = 10, port: int = DEFAULT_PORT) -> dict:
    browser = get_browser(port)
    route = url.replace("http://localhost:3000", "") or "/"
    browser.navigate_route(wait_ms=wait * 1000, route=route)
    result = browser.evaluate(script)
    return {
        "success": result.get("success", False),
        "result": result.get("result", result.get("raw")),
        "error": result.get("error"),
    }


def interactive(commands_file: str, output_dir: Optional[str] = None, port: int = DEFAULT_PORT) -> dict:
    ensure_dirs()
    output = output_dir or str(SCREENSHOT_DIR)
    browser = get_browser(port)

    with open(commands_file) as f:
        actions = json.load(f)

    results = browser.interactive_session(actions, output_dir=output)
    ok = sum(1 for r in results if r.get("success"))
    return {
        "success": ok == len(results),
        "total_steps": len(results),
        "passed_steps": ok,
        "output_dir": output,
        "results": results,
    }


def generate_commands_file(
    routes: list,
    output_file: str = "scripts/dev/commands/generated.json",
    base_url: str = "http://localhost:3000",
    wait_ms: int = 10000,
) -> str:
    ensure_dirs()

    commands = []
    for route in routes:
        name = route.strip("/").replace("/", "_") or "home"
        commands.append({
            "action": "screenshot",
            "url": f"{base_url}{route}",
            "output": f"{name}.png",
            "wait_ms": wait_ms,
            "full_page": True,
        })

    output_path = Path(output_file)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, "w") as f:
        json.dump(commands, f, indent=2)

    return str(output_path)


def main():
    parser = argparse.ArgumentParser(description="Hikari Browser Debug Helper (Python/Tairitsu-MCP)")
    subparsers = parser.add_subparsers(dest="command", required=True)

    screenshot_parser = subparsers.add_parser("screenshot", help="Capture screenshot")
    screenshot_parser.add_argument("--url", default="http://localhost:3000")
    screenshot_parser.add_argument("--output", default="screenshot.png")
    screenshot_parser.add_argument("--wait", type=int, default=10)
    screenshot_parser.add_argument("--inject", help="JavaScript to inject before screenshot")
    screenshot_parser.add_argument("--no-full-page", action="store_true")
    screenshot_parser.add_argument("--port", type=int, default=DEFAULT_PORT)

    check_parser = subparsers.add_parser("check", help="Check page status")
    check_parser.add_argument("--url", default="http://localhost:3000")
    check_parser.add_argument("--wait", type=int, default=10)
    check_parser.add_argument("--port", type=int, default=DEFAULT_PORT)

    script_parser = subparsers.add_parser("script", help="Execute JavaScript")
    script_parser.add_argument("--url", default="http://localhost:3000")
    script_parser.add_argument("--script", required=True)
    script_parser.add_argument("--wait", type=int, default=10)
    script_parser.add_argument("--port", type=int, default=DEFAULT_PORT)

    interactive_parser = subparsers.add_parser("interactive", help="Run commands from JSON")
    interactive_parser.add_argument("--input", default="scripts/dev/commands/example_commands.json")
    interactive_parser.add_argument("--output-dir")
    interactive_parser.add_argument("--port", type=int, default=DEFAULT_PORT)

    generate_parser = subparsers.add_parser("generate", help="Generate commands file from routes")
    generate_parser.add_argument("--routes", nargs="+", required=True)
    generate_parser.add_argument("--output", default="scripts/dev/commands/generated.json")
    generate_parser.add_argument("--base-url", default="http://localhost:3000")

    args = parser.parse_args()

    if args.command == "screenshot":
        result = screenshot(
            url=args.url,
            output=args.output,
            wait=args.wait,
            inject=args.inject,
            full_page=not args.no_full_page,
            port=getattr(args, 'port', DEFAULT_PORT),
        )
    elif args.command == "check":
        result = check(url=args.url, wait=args.wait, port=getattr(args, 'port', DEFAULT_PORT))
    elif args.command == "script":
        result = execute_script(
            url=args.url, script=args.script, wait=args.wait,
            port=getattr(args, 'port', DEFAULT_PORT),
        )
    elif args.command == "interactive":
        result = interactive(
            commands_file=args.input, output_dir=args.output_dir,
            port=getattr(args, 'port', DEFAULT_PORT),
        )
    elif args.command == "generate":
        result = {"success": True, "file": generate_commands_file(
            routes=args.routes,
            output_file=args.output,
            base_url=args.base_url,
        )}
    else:
        result = {"success": False, "error": "Unknown command"}

    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()

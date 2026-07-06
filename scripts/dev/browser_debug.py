#!/usr/bin/env python3
"""
Hikari Browser Debug Helper
Provides convenient interface for AI agents to debug and analyze UI components.
"""

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Optional

SCREENSHOT_DIR = Path("scripts/dev/screenshots")
COMMANDS_DIR = Path("scripts/dev/commands")

def ensure_dirs():
    SCREENSHOT_DIR.mkdir(exist_ok=True)
    COMMANDS_DIR.mkdir(exist_ok=True)

def run_browser_debug(args: list) -> dict:
    cmd = [
        "cargo", "run", "--release",
        "--package", "hikari-e2e",
        "--bin", "hikari-browser-debug",
        "--"
    ] + args
    
    result = subprocess.run(cmd, capture_output=True, text=True)
    
    if result.returncode != 0:
        return {
            "success": False,
            "error": result.stderr,
            "stdout": result.stdout
        }
    
    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError:
        return {
            "success": True,
            "raw_output": result.stdout
        }

def screenshot(
    url: str = "http://localhost:3000",
    output: str = "screenshot.png",
    wait: int = 10,
    inject: Optional[str] = None,
    full_page: bool = True
) -> dict:
    ensure_dirs()
    output_path = SCREENSHOT_DIR / output
    
    args = [
        "navigate",
        "--url", url,
        "--output", str(output_path),
        "--wait", str(wait),
    ]
    
    if inject:
        args.extend(["--inject", inject])
    if full_page:
        args.append("--full-page")
    
    return run_browser_debug(args)

def check(url: str = "http://localhost:3000", wait: int = 10) -> dict:
    return run_browser_debug([
        "check",
        "--url", url,
        "--wait", str(wait)
    ])

def execute_script(url: str, script: str, wait: int = 10) -> dict:
    return run_browser_debug([
        "script",
        "--url", url,
        "--script", script,
        "--wait", str(wait)
    ])

def interactive(commands_file: str, output_dir: Optional[str] = None) -> dict:
    ensure_dirs()
    output = output_dir or str(SCREENSHOT_DIR)
    
    return run_browser_debug([
        "interactive",
        "--input", commands_file,
        "--output-dir", output
    ])

def generate_commands_file(
    routes: list,
    output_file: str = "scripts/dev/commands/generated.json",
    base_url: str = "http://localhost:3000",
    wait_ms: int = 10000
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
            "full_page": True
        })
    
    output_path = Path(output_file)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(output_path, "w") as f:
        json.dump(commands, f, indent=2)
    
    return str(output_path)

def main():
    parser = argparse.ArgumentParser(description="Hikari Browser Debug Helper")
    subparsers = parser.add_subparsers(dest="command", required=True)
    
    screenshot_parser = subparsers.add_parser("screenshot", help="Capture screenshot")
    screenshot_parser.add_argument("--url", default="http://localhost:3000")
    screenshot_parser.add_argument("--output", default="screenshot.png")
    screenshot_parser.add_argument("--wait", type=int, default=10)
    screenshot_parser.add_argument("--inject", help="JavaScript to inject before screenshot")
    screenshot_parser.add_argument("--no-full-page", action="store_true")
    
    check_parser = subparsers.add_parser("check", help="Check page status")
    check_parser.add_argument("--url", default="http://localhost:3000")
    check_parser.add_argument("--wait", type=int, default=10)
    
    script_parser = subparsers.add_parser("script", help="Execute JavaScript")
    script_parser.add_argument("--url", default="http://localhost:3000")
    script_parser.add_argument("--script", required=True)
    script_parser.add_argument("--wait", type=int, default=10)
    
    interactive_parser = subparsers.add_parser("interactive", help="Run commands from JSON")
    interactive_parser.add_argument("--input", default="scripts/dev/commands/example_commands.json")
    interactive_parser.add_argument("--output-dir")
    
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
            full_page=not args.no_full_page
        )
    elif args.command == "check":
        result = check(url=args.url, wait=args.wait)
    elif args.command == "script":
        result = execute_script(url=args.url, script=args.script, wait=args.wait)
    elif args.command == "interactive":
        result = interactive(commands_file=args.input, output_dir=args.output_dir)
    elif args.command == "generate":
        result = {"success": True, "file": generate_commands_file(
            routes=args.routes,
            output_file=args.output,
            base_url=args.base_url
        )}
    else:
        result = {"success": False, "error": "Unknown command"}
    
    print(json.dumps(result, indent=2))

if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Run visual quality and interactive behavior tests.

Converted from scripts/run_visual_quality_tests.sh on 2026-10-06 per the
workspace tooling-script policy (AGENTS.md §7.5, extended 2026-10-06).
"""

import os
import subprocess
import sys
import urllib.error
import urllib.request

E2E_DIR = "/mnt/sdb1/hikari/packages/e2e"


def url_responds(url: str) -> bool:
    """Mirror `curl -s <url> > /dev/null`: any HTTP response counts as up."""
    try:
        with urllib.request.urlopen(url):
            pass
    except urllib.error.HTTPError:
        return True
    except urllib.error.URLError:
        return False
    return True


def main() -> int:
    # bash echo(1) wrote each line immediately; keep the same interleaving
    # with the cargo child output even when stdout is redirected.
    sys.stdout.reconfigure(line_buffering=True)

    print("------")
    print("Hikari Visual Quality Test Runner")
    print("------")
    print("")

    # Check if Selenium is running
    if not url_responds("http://localhost:4444/wd/hub/status"):
        print("Error: Selenium WebDriver is not running")
        print("Please start Selenium with:")
        print("  docker run -d -p 4444:4444 selenium/standalone-chrome")
        return 1

    # Check if website is running
    if not url_responds("http://localhost:3000"):
        print("Error: Website is not running")
        print("Please start the website with:")
        print("  cd examples/website && cargo run --features server")
        return 1

    print("✓ Selenium WebDriver is running")
    print("✓ Website is running at http://localhost:3000")
    print("  (Will access from Docker as http://host.docker.internal:3000)")
    print("")

    # Build the visual quality test binary
    print("Building visual quality test binary...")
    try:
        os.chdir(E2E_DIR)
    except OSError as exc:
        print(f"cd: {E2E_DIR}: {exc.strerror}", file=sys.stderr)
        return 1
    build = subprocess.run(["cargo", "build", "--bin", "hikari-visual-quality"])
    if build.returncode != 0:
        return build.returncode

    # Run visual quality tests
    print("")
    print("Running visual quality tests...")
    run = subprocess.run(["cargo", "run", "--bin", "hikari-visual-quality"])
    if run.returncode != 0:
        return run.returncode

    print("")
    print("------")
    print("✓ Visual quality tests completed")
    print("------")
    return 0


if __name__ == "__main__":
    sys.exit(main())

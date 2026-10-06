#!/usr/bin/env python3
"""Blocking E2E screenshot test runner.

Runs all routes sequentially in a single container.

Converted from scripts/run_screenshot_blocking.sh on 2026-10-06 per the
workspace tooling-script policy (AGENTS.md §7.5, extended 2026-10-06).
"""

import os
import re
import subprocess
import sys
from glob import glob
from pathlib import Path

# Configuration
TOTAL_ROUTES = 34
IMAGE_NAME = "hikari/screenshot:selenium"

# Colors for output
RED = "\033[0;31m"
GREEN = "\033[0;32m"
YELLOW = "\033[1;33m"
NC = "\033[0m"  # No Color

# Lines of docker build output to keep (was: grep -E "^(Step|...)" over 2>&1).
BUILD_OUTPUT_LINES = re.compile(r"^(Step|Successfully|Sending|Building|built)")


def main() -> int:
    # bash echo(1) wrote each line immediately; keep the same interleaving
    # with the docker child output even when stdout is redirected.
    sys.stdout.reconfigure(line_buffering=True)

    print("------")
    print("Hikari Blocking E2E Screenshot Test Runner")
    print("------")
    print(f"Total routes: {TOTAL_ROUTES}")
    print("------")
    print("")

    # Remove old containers
    print(f"{YELLOW}Cleaning up old containers...{NC}")
    subprocess.run(
        ["docker", "compose", "-f", "scripts/docker-compose-selenium.yml", "down"],
        stderr=subprocess.DEVNULL,
    )
    listing = subprocess.run(
        ["docker", "ps", "-a", "--filter", "name=hikari-screenshot", "-q"],
        stdout=subprocess.PIPE,
        text=True,
    )
    container_ids = [line for line in listing.stdout.splitlines() if line]
    if container_ids:
        subprocess.run(
            ["docker", "rm", "-f", *container_ids],
            stderr=subprocess.DEVNULL,
        )
    print("")

    # Create output directory
    os.makedirs("target/e2e_screenshots", exist_ok=True)

    # Build base image if needed
    print(f"{YELLOW}Building base image...{NC}")
    build = subprocess.run(
        [
            "docker",
            "build",
            "-t",
            IMAGE_NAME,
            "-f",
            "docker/base-selenium.Dockerfile",
            ".",
        ],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )
    for line in build.stdout.splitlines():
        if BUILD_OUTPUT_LINES.match(line):
            print(line)
    print("")

    # Run screenshot test
    print(f"{YELLOW}Running E2E test in blocking mode...{NC}")
    print("")

    pwd = Path.cwd()
    run = subprocess.run(
        [
            "docker",
            "run",
            "--rm",
            "--name",
            "hikari-screenshot",
            "--network",
            "host",
            "-v",
            f"{pwd}/target/e2e_screenshots:/tmp/e2e_screenshots",
            "-v",
            f"{pwd}/examples/website/public:/public:ro",
            IMAGE_NAME,
            "/usr/local/bin/hikari-screenshot",
        ]
    )
    if run.returncode != 0:
        return run.returncode

    print("")
    print("------")

    # Count screenshots
    screenshot_count = len(glob("target/e2e_screenshots/*.png"))
    print(f"Screenshots generated: {GREEN}{screenshot_count}{NC}/{TOTAL_ROUTES}")

    if screenshot_count == TOTAL_ROUTES:
        print(f"{GREEN}✓ E2E test completed successfully{NC}")
        return 0
    print(f"{RED}✗ E2E test completed with errors{NC}")
    return 1


if __name__ == "__main__":
    sys.exit(main())

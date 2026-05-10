#!/usr/bin/env python3
"""Parallel E2E screenshot test runner.

Distributes routes across multiple containers to utilize multiple CPU cores.
"""

import argparse
import os
import subprocess
import sys
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed


# Configuration
TOTAL_ROUTES = 34
NUM_CONTAINERS = 8  # Adjust based on CPU cores
ROUTES_PER_CONTAINER = (TOTAL_ROUTES + NUM_CONTAINERS - 1) // NUM_CONTAINERS
IMAGE_NAME = "hikari/screenshot:selenium"

# ANSI colors
RED = "\033[0;31m"
GREEN = "\033[0;32m"
YELLOW = "\033[1;33m"
NC = "\033[0m"  # No Color


def run_command(cmd, check=False, capture_output=True):
    """Run a shell command."""
    result = subprocess.run(
        cmd,
        shell=True,
        check=check,
        capture_output=capture_output,
        text=True
    )
    return result


def cleanup_old_containers():
    """Remove old containers."""
    print(f"{YELLOW}Cleaning up old containers...{NC}")
    run_command(
        "docker compose -f scripts/docker-compose-selenium.yml down 2>/dev/null || true",
        check=False
    )
    run_command(
        "docker ps -a --filter 'name=hikari-screenshot-' -q | xargs -r docker rm -f 2>/dev/null || true",
        check=False
    )
    print()


def build_base_image():
    """Build the base Docker image."""
    print(f"{YELLOW}Building base image...{NC}")
    run_command(
        f"docker build -t {IMAGE_NAME} -f docker/base-selenium.Dockerfile . "
        "2>&1 | grep -E '^(Step|Successfully|Sending|Building|built)' || true",
        check=False
    )
    print()


def run_container(container_id, start_idx, end_idx, project_root):
    """Run a single container."""
    print(
        f"{GREEN}Starting container hikari-screenshot-{container_id} "
        f"(routes {start_idx}..{end_idx}){NC}"
    )

    log_file = project_root / "target" / "e2e_screenshots" / f"screenshot-{container_id}.log"

    cmd = (
        f"docker run --rm "
        f"--name hikari-screenshot-{container_id} "
        f"--network host "
        f"-v '{project_root}/target/e2e_screenshots:/tmp/e2e_screenshots' "
        f"-v '{project_root}/examples/website/public:/public:ro' "
        f"{IMAGE_NAME} "
        f"/usr/local/bin/hikari-screenshot "
        f"--start {start_idx} --end {end_idx} "
        f"> '{log_file}' 2>&1"
    )

    result = run_command(cmd, check=False)
    exit_code = result.returncode

    if exit_code == 0:
        print(f"{GREEN}✓ Container hikari-screenshot-{container_id} completed successfully{NC}")
    else:
        print(f"{RED}✗ Container hikari-screenshot-{container_id} failed with exit code {exit_code}{NC}")

    return exit_code


def count_screenshots(project_root):
    """Count generated screenshots."""
    screenshots_dir = project_root / "target" / "e2e_screenshots"
    try:
        count = len(list(screenshots_dir.glob("*.png")))
        return count
    except FileNotFoundError:
        return 0


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Parallel E2E screenshot test runner"
    )
    parser.add_argument(
        "--routes", "-r",
        type=int,
        default=TOTAL_ROUTES,
        help=f"Total number of routes (default: {TOTAL_ROUTES})"
    )
    parser.add_argument(
        "--containers", "-c",
        type=int,
        default=NUM_CONTAINERS,
        help=f"Number of containers (default: {NUM_CONTAINERS})"
    )
    args = parser.parse_args()

    total_routes = args.routes
    num_containers = args.containers
    routes_per_container = (total_routes + num_containers - 1) // num_containers

    print("=" * 42)
    print("Hikari Parallel E2E Screenshot Test Runner")
    print("=" * 42)
    print(f"Total routes: {total_routes}")
    print(f"Number of containers: {num_containers}")
    print(f"Routes per container: {routes_per_container}")
    print("=" * 42)
    print()

    # Get project root
    project_root = Path.cwd()

    # Cleanup
    cleanup_old_containers()

    # Create output directory
    screenshots_dir = project_root / "target" / "e2e_screenshots"
    screenshots_dir.mkdir(parents=True, exist_ok=True)

    # Build base image
    build_base_image()

    # Run containers in parallel
    print(f"{YELLOW}Launching {num_containers} containers in parallel...{NC}")
    print()

    container_pids = []

    with ThreadPoolExecutor(max_workers=num_containers) as executor:
        futures = []
        for i in range(num_containers):
            start_idx = i * routes_per_container
            end_idx = start_idx + routes_per_container
            if end_idx > total_routes:
                end_idx = total_routes

            if start_idx >= total_routes:
                break

            future = executor.submit(
                run_container,
                i,
                start_idx,
                end_idx,
                project_root
            )
            futures.append(future)

        # Wait for all containers
        print()
        print(f"{YELLOW}Waiting for all containers to complete...{NC}")
        print()

        all_success = True
        for future in as_completed(futures):
            exit_code = future.result()
            if exit_code != 0:
                all_success = False

    print()
    print("=" * 42)
    if all_success:
        print(f"{GREEN}✓ All containers completed successfully{NC}")
    else:
        print(f"{RED}✗ Some containers failed{NC}")
    print("=" * 42)
    print()

    # Count screenshots
    screenshot_count = count_screenshots(project_root)
    print(f"Screenshots generated: {GREEN}{screenshot_count}{NC}/{total_routes}")

    if all_success and screenshot_count == total_routes:
        print(f"{GREEN}✓ E2E test completed successfully{NC}")
        return 0
    else:
        print(f"{RED}✗ E2E test completed with errors{NC}")
        return 1


if __name__ == "__main__":
    sys.exit(main())

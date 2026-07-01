#!/usr/bin/env python3
"""Publish workspace crates to crates.io in dependency order with index propagation wait."""

import json
import subprocess
import sys
import time
import urllib.request
import urllib.error

PUBLISHABLE_PREFIX = "hikari"
MAX_WAIT_SECONDS = 300
POLL_INTERVAL = 5
EXCLUDE_PACKAGES = {"hikari-e2e"}


def run_captured(cmd):
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if result.stdout.strip():
        print(result.stdout.strip())
    return result


def run_streaming(cmd):
    print(f"  $ {cmd}")
    sys.stdout.flush()
    proc = subprocess.Popen(
        cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True
    )
    for line in proc.stdout:
        print(line, end="")
        sys.stdout.flush()
    proc.wait()
    return proc.returncode


def get_workspace_packages():
    print("  $ cargo metadata --format-version 1 --no-deps")
    result = subprocess.run(
        ["cargo", "metadata", "--format-version", "1", "--no-deps"],
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        print(result.stderr, file=sys.stderr)
        sys.exit(1)

    metadata = json.loads(result.stdout)
    packages = {}

    for pkg in metadata["packages"]:
        name = pkg["name"]
        if not name.startswith(PUBLISHABLE_PREFIX):
            continue
        if name in EXCLUDE_PACKAGES:
            continue
        if "publish" in pkg and pkg["publish"] == []:
            continue
        manifest = pkg.get("manifest_path", "")
        if "/examples/" in manifest:
            continue

        deps = set()
        for dep in pkg["dependencies"]:
            if dep["name"].startswith(PUBLISHABLE_PREFIX) and dep["name"] not in EXCLUDE_PACKAGES:
                deps.add(dep["name"])

        packages[name] = {"version": pkg["version"], "dependencies": deps}

    print(f"  Found {len(packages)} publishable packages")
    return packages


def topological_sort(packages):
    order = []
    visited = set()
    visiting = set()

    def visit(name):
        if name in visited:
            return
        if name in visiting:
            print(f"ERROR: cyclic dependency involving {name}", file=sys.stderr)
            sys.exit(1)
        visiting.add(name)
        for dep in packages[name]["dependencies"]:
            if dep in packages:
                visit(dep)
        visiting.remove(name)
        visited.add(name)
        order.append(name)

    for name in sorted(packages):
        visit(name)

    return order


def wait_for_crate(name, version):
    url = f"https://crates.io/api/v1/crates/{name}/versions"
    deadline = time.time() + MAX_WAIT_SECONDS
    attempt = 0

    while time.time() < deadline:
        attempt += 1
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "hikari-ci-publish"})
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read())
                for v in data.get("versions", []):
                    if v.get("num") == version:
                        print(f"  [{attempt}] {name} v{version} is live on crates.io")
                        return True
        except (urllib.error.URLError, json.JSONDecodeError) as e:
            print(f"  [{attempt}] API error: {e}")

        remaining = int(deadline - time.time())
        print(f"  [{attempt}] {name} v{version} not yet indexed, {remaining}s remaining...")
        sys.stdout.flush()
        time.sleep(POLL_INTERVAL)

    print(f"  WARNING: {name} v{version} not visible after {MAX_WAIT_SECONDS}s", file=sys.stderr)
    return False


def check_crate_version_exists(name, version):
    """Check if a specific version of a crate exists on crates.io."""
    url = f"https://crates.io/api/v1/crates/{name}/versions"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "hikari-ci-publish"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read())
            for v in data.get("versions", []):
                if v.get("num") == version:
                    return True
    except (urllib.error.URLError, json.JSONDecodeError):
        pass
    return False


def publish_package(name, version):
    print(f"\n{'=' * 60}")
    print(f"  Publishing {name} v{version}")
    print(f"{'=' * 60}")
    sys.stdout.flush()

    rc = run_streaming(f"cargo publish -p {name} --allow-dirty -v")

    if rc != 0:
        already_exists = check_crate_version_exists(name, version)
        if already_exists:
            print(f"  {name} v{version} already exists on crates.io, skipping...")
            sys.stdout.flush()
        else:
            print(
                f"  FATAL: {name} v{version} publish failed and version not on crates.io",
                file=sys.stderr,
            )
            sys.exit(1)
    else:
        print(f"  {name} v{version} upload succeeded")
        sys.stdout.flush()

    wait_for_crate(name, version)


def main():
    print("=" * 60)
    print("  crates.io Publish Script")
    print("=" * 60)
    print()
    print("Resolving workspace packages...")
    packages = get_workspace_packages()

    if not packages:
        print("No publishable packages found")
        sys.exit(0)

    order = topological_sort(packages)
    print(f"\nPublish order ({len(order)} packages):")
    for i, name in enumerate(order, 1):
        v = packages[name]["version"]
        deps = sorted(packages[name]["dependencies"])
        dep_str = f" <- {', '.join(deps)}" if deps else ""
        print(f"  {i}. {name} v{v}{dep_str}")
    sys.stdout.flush()

    for name in order:
        publish_package(name, packages[name]["version"])

    print(f"\n{'=' * 60}")
    print(f"  All {len(order)} packages processed")
    print(f"{'=' * 60}")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Ensure wasm-bindgen CLI version matches the project requirement."""

import re
import subprocess
import sys
from typing import Optional

DEFAULT_VERSION = "0.2.106"


def get_current_version() -> Optional[str]:
    try:
        result = subprocess.run(
            ["wasm-bindgen", "--version"],
            check=True,
            capture_output=True,
            text=True,
        )
        match = re.search(r"(\d+\.\d+\.\d+)", result.stdout)
        return match.group(1) if match else None
    except (subprocess.CalledProcessError, FileNotFoundError):
        return None


def install_version(version: str) -> None:
    print(f"[INFO] Installing wasm-bindgen-cli {version}...")
    subprocess.run(
        ["cargo", "install", "-f", "wasm-bindgen-cli", "--version", version],
        check=True,
    )


def main() -> int:
    required = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_VERSION
    current = get_current_version()

    if current == required:
        print(f"[OK] wasm-bindgen-cli already at {required}")
        return 0

    if current:
        print(f"[WARN] wasm-bindgen-cli version mismatch: current={current}, required={required}")
    else:
        print("[WARN] wasm-bindgen-cli is missing or version unknown")

    try:
        install_version(required)
    except subprocess.CalledProcessError as err:
        print(f"[ERROR] Failed to install wasm-bindgen-cli {required}: {err}")
        return 1

    updated = get_current_version()
    if updated != required:
        print(f"[ERROR] wasm-bindgen-cli verification failed: got={updated}, expected={required}")
        return 1

    print(f"[OK] wasm-bindgen-cli updated to {required}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

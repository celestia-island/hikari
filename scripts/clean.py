#!/usr/bin/env python3
"""Clean build artifacts."""
from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

WORKSPACE_ROOT = Path(__file__).resolve().parent.parent.parent


def main():
    print("  → Cleaning...")
    subprocess.run(["cargo", "clean"], cwd=str(WORKSPACE_ROOT), capture_output=True)

    for d in [
        WORKSPACE_ROOT / "examples" / "website" / "dist",
        WORKSPACE_ROOT / "packages" / "icons" / "src" / "generated",
        WORKSPACE_ROOT / "public",
    ]:
        if d.exists():
            shutil.rmtree(str(d))

    print("  ✓  Clean completed")


if __name__ == "__main__":
    main()

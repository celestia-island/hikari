#!/usr/bin/env python3
"""Download MDI SVG icons from GitHub and extract to workspace."""
from __future__ import annotations

import shutil
import sys
import tempfile
import zipfile
from pathlib import Path

try:
    import requests
except ImportError:
    from urllib.request import urlretrieve
    requests = None

WORKSPACE_ROOT = Path(__file__).resolve().parent.parent.parent
ICONS_DIR = WORKSPACE_ROOT / "icons" / "mdi"
MDI_URL = "https://github.com/Templarian/MaterialDesign/archive/refs/heads/master.zip"


def main():
    ICONS_DIR.mkdir(parents=True, exist_ok=True)

    print("  → Downloading MDI icons...")
    tmp_dir = Path(tempfile.mkdtemp(prefix="hikari-icons-"))
    zip_path = tmp_dir / "mdi.zip"

    try:
        if requests:
            r = requests.get(MDI_URL, stream=True, timeout=120)
            r.raise_for_status()
            zip_path.write_bytes(r.content)
        else:
            urlretrieve(MDI_URL, str(zip_path))

        print("  → Extracting SVGs...")
        with zipfile.ZipFile(str(zip_path)) as zf:
            for info in zf.infolist():
                if info.filename.startswith("MaterialDesign-master/svg/") and info.filename.endswith(".svg"):
                    info.filename = Path(info.filename).name
                    zf.extract(info, str(ICONS_DIR))

        count = len(list(ICONS_DIR.glob("*.svg")))
        print(f"  ✓ Extracted {count} icons to {ICONS_DIR}")
    finally:
        shutil.rmtree(str(tmp_dir), ignore_errors=True)


if __name__ == "__main__":
    main()

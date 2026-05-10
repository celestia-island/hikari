#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Hikari MDI Icon Fetcher - Simplified

Downloads Material Design Icons SVG files.
Icons are then loaded at compile time using tairitsu's svg! macro.

Output:
  icons/mdi/{name}.svg  - Individual SVG files
"""

import urllib.request
import tempfile
import zipfile
import sys
import io
from pathlib import Path

# Set UTF-8 encoding for stdout on Windows
if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# MDI download URL
MDI_REPO_ZIP = "https://github.com/Templarian/MaterialDesign/archive/refs/heads/master.zip"

# Output directory
WORKSPACE_ROOT = Path(__file__).parent.parent.parent
ICONS_DIR = WORKSPACE_ROOT / "icons" / "mdi"


def download_and_extract_icons():
    """Download and extract MDI SVG files"""
    print("  →  Downloading MDI icons...")

    tmp_dir = Path(tempfile.gettempdir()) / "hikari-icons"
    tmp_dir.mkdir(parents=True, exist_ok=True)
    zip_path = tmp_dir / "mdi.zip"

    # Download
    try:
        request = urllib.request.Request(
            MDI_REPO_ZIP,
            headers={'User-Agent': 'Hikari-Icon-Generator/1.0'}
        )
        with urllib.request.urlopen(request, timeout=60) as response:
            with open(zip_path, 'wb') as f:
                f.write(response.read())
    except Exception as e:
        print(f"  ✗  Failed to download: {e}")
        return False

    # Extract SVG files
    ICONS_DIR.mkdir(parents=True, exist_ok=True)
    count = 0

    with zipfile.ZipFile(zip_path, 'r') as zf:
        svg_files = [f for f in zf.namelist() if f.endswith('.svg') and '/svg/' in f]

        for svg_file in svg_files:
            icon_name = svg_file.split('/')[-1].replace('.svg', '')
            svg_content = zf.read(svg_file).decode('utf-8')

            output_path = ICONS_DIR / f"{icon_name}.svg"
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(svg_content)
            count += 1

    # Cleanup
    zip_path.unlink(missing_ok=True)

    print(f"  ✓  Extracted {count} icons to {ICONS_DIR}")
    return True


def main():
    print("  ╭──────────────────────────────────────────────────╮")
    print("  │  MDI Icon Fetcher                                │")
    print("  ╰──────────────────────────────────────────────────╯")

    if download_and_extract_icons():
        print("\n  Usage in Rust:")
        print('    use tairitsu_macros::svg;')
        print('    let icon = svg! { id: "mdi/account" };')
    else:
        sys.exit(1)


if __name__ == "__main__":
    main()

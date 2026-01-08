#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Fix Dioxus index.html resource paths

This script modifies the generated index.html to use absolute paths
instead of relative paths, ensuring resources load correctly on all routes.
"""

import sys
import re
from pathlib import Path


def fix_index_html(html_path: Path, base_dir: Path) -> bool:
    """
    Fix resource paths in index.html to use absolute paths.

    Changes:
    - './assets/website.js' â†?'/assets/website.js'
    - './assets/website_bg.wasm' â†?'/assets/website_bg.wasm'

    Also adds <base href="/"> tag to ensure all relative paths
    are resolved from the root.
    """
    try:
        content = html_path.read_text(encoding="utf-8")
    except Exception as e:
        print(f"[ERROR] Failed to read {html_path}: {e}")
        return False

    original = content

    # Add <base href="/"> tag if not present
    if "<base" not in content:
        content = re.sub(
            r'(<head>)',
            r'\1    <base href="/">',
            content,
            count=1
        )

    # Fix relative paths in import statement
    content = re.sub(
        r"from '\./assets/",
        "from '/assets/",
        content
    )

    # Fix relative paths in init() call
    content = re.sub(
        r"init\('\./assets/",
        "init('/assets/",
        content
    )

    # Write back if changed
    if content != original:
        try:
            html_path.write_text(content, encoding="utf-8")
            print(f"[OK] Fixed {html_path.relative_to(base_dir)}")
            return True
        except Exception as e:
            print(f"[ERROR] Failed to write {html_path}: {e}")
            return False
    else:
        print(f"[SKIP] Already fixed: {html_path.relative_to(base_dir)}")
        return True


def main():
    """Main workflow"""
    if len(sys.argv) < 2:
        print("Usage: python fix_index_html.py <index.html_path>")
        print("")
        print("Example:")
        print("  python fix_index_html.py examples/website/dist/index.html")
        sys.exit(1)

    html_path = Path(sys.argv[1]).resolve()
    base_dir = Path.cwd().resolve()

    if not html_path.exists():
        print(f"[ERROR] File not found: {html_path}")
        sys.exit(1)

    print("=" * 60)
    print("Dioxus index.html Resource Path Fixer")
    print("=" * 60)
    print("")

    success = fix_index_html(html_path, base_dir)

    print("")
    print("=" * 60)

    if success:
        print("[OK] Fix complete!")
        print("")
        print("Changes:")
        print("  - Added <base href=\"/\"> to <head>")
        print("  - Changed './assets/' â†?'/assets/' in scripts")
        print("  - Resources now load correctly on all routes")
    else:
        print("[ERROR] Fix failed")
        sys.exit(1)


if __name__ == "__main__":
    main()

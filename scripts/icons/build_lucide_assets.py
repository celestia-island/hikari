#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Hikari Icon Assets Generator

Downloads all Lucide SVG icons from GitHub and packs them into a format
that can be embedded in Rust using include_str!() for runtime serving.

Output: packages/icons/assets/lucide_svgs.rs
"""

import requests
import json
import re
import sys
import io
from pathlib import Path
from typing import Dict
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed

# Concurrency settings
MAX_WORKERS = 10

# Set UTF-8 encoding for stdout on Windows
if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# GitHub API endpoints
GITHUB_API = "https://api.github.com/repos/lucide-icons/lucide/contents/icons"
GITHUB_RAW = "https://raw.githubusercontent.com/lucide-icons/lucide/main/icons"

# Output paths
OUTPUT_DIR = Path("packages/icons/assets")
JSON_FILE = OUTPUT_DIR / "lucide_svgs.json"
MANIFEST_FILE = OUTPUT_DIR / "lucide_manifest.json"

# SVG compression options
COMPRESS_SVG = True  # Remove unnecessary whitespace and newlines


def download_svg(icon_name: str) -> str | None:
    """Download a single SVG icon from GitHub"""
    url = f"{GITHUB_RAW}/{icon_name}.svg"
    
    try:
        response = requests.get(url, timeout=10, headers={
            'Accept': 'application/vnd.github.raw',
            'User-Agent': 'Hikari-Icon-Generator/1.0'
        })
        response.raise_for_status()
        return response.text
    except Exception as e:
        print(f"  ERROR: Failed to download {icon_name}: {e}")
        return None


def compress_svg(svg_content: str) -> str:
    """Compress SVG by removing unnecessary whitespace"""
    # Remove extra whitespace between tags
    compressed = re.sub(r'>\s+<', '><', svg_content)
    # Remove leading/trailing whitespace
    compressed = compressed.strip()
    return compressed


def fetch_icon_list() -> list[str]:
    """Fetch all icon names from Lucide GitHub API"""
    print("Fetching icon list from GitHub...")
    try:
        response = requests.get(GITHUB_API, timeout=30, headers={
            'Accept': 'application/vnd.github.v3+json'
        })
        response.raise_for_status()
        data = response.json()

        # Extract icon names (remove .svg extension)
        icons = [item['name'].replace('.svg', '') for item in data if item['name'].endswith('.svg')]
        icons.sort()

        print(f"  OK: Found {len(icons)} icons")
        return icons
    except Exception as e:
        print(f"  ERROR: Failed to fetch icon list: {e}")
        raise





def main():
    """Main generation workflow"""
    print("=" * 60)
    print("Hikari Icon Assets Generator")
    print("=" * 60)
    
    # Create output directory
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    
    # Fetch icon list
    icons = fetch_icon_list()
    
    # Download all SVG icons with concurrency
    print(f"\nDownloading {len(icons)} SVG icons (with {MAX_WORKERS} workers)...")
    svg_map = {}
    failed_icons = []
    completed = 0
    
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        # Submit all download tasks
        future_to_icon = {
            executor.submit(download_svg, icon_name): icon_name
            for icon_name in icons
        }
        
        # Process completed downloads
        for future in as_completed(future_to_icon):
            icon_name = future_to_icon[future]
            completed += 1
            
            if completed % 50 == 0:
                print(f"  Progress: {completed}/{len(icons)}")
            
            try:
                svg_content = future.result()
                if svg_content:
                    if COMPRESS_SVG:
                        svg_content = compress_svg(svg_content)
                    svg_map[icon_name] = svg_content
                else:
                    failed_icons.append(icon_name)
            except Exception as e:
                print(f"  ERROR: Exception for {icon_name}: {e}")
                failed_icons.append(icon_name)
    
    if failed_icons:
        print(f"\nWARNING: Failed to download {len(failed_icons)} icons:")
        for icon in failed_icons[:10]:
            print(f"    - {icon}")
        if len(failed_icons) > 10:
            print(f"    ... and {len(failed_icons) - 10} more")
    
    print(f"  OK: Successfully downloaded {len(svg_map)} icons")

    # Write JSON file
    print("\nWriting JSON file...")
    json_data = json.dumps(svg_map, ensure_ascii=False, separators=(',', ':'))
    JSON_FILE.write_text(json_data, encoding='utf-8')
    print(f"  OK: Generated {JSON_FILE} ({len(json_data)} bytes)")

    # Write manifest
    print("Writing manifest file...")
    manifest = {
        "generated_at": datetime.now().isoformat(),
        "total_icons": len(icons),
        "downloaded_icons": len(svg_map),
        "failed_icons": failed_icons,
        "compress_svg": COMPRESS_SVG,
    }
    MANIFEST_FILE.write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    print(f"  OK: Generated {MANIFEST_FILE}")

    # Print summary
    print("\n" + "=" * 60)
    print("SUCCESS!")
    print("=" * 60)
    print(f"Total icons: {len(icons)}")
    print(f"Downloaded: {len(svg_map)}")
    print(f"Failed: {len(failed_icons)}")
    print(f"\nOutput files:")
    print(f"  - {JSON_FILE}")
    print(f"  - {MANIFEST_FILE}")
    print(f"\nRust usage:")
    print(f"  use hikari_icons::assets::get_icon;")
    print(f"  let svg = get_icon(\"menu\").unwrap();")
    print("=" * 60)


if __name__ == "__main__":
    main()

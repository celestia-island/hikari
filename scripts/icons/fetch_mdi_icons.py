#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Hikari Material Design Icons Fetcher

Downloads all Material Design Icons SVG files and metadata.
Generates:
1. Icon enum with all icon names (hikari-icons)
2. SVG assets stored in hikari-builder/generated/mdi_svgs/
3. Metadata JSON for icon discovery

Output:
- packages/icons/src/generated/mdi.rs (enum only)
- packages/builder/generated/mdi_svgs/ (all SVG files)
- packages/builder/generated/mdi_metadata.json (metadata)
"""

import urllib.request
import json
import io
import sys
import zipfile
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Set
from concurrent.futures import ThreadPoolExecutor, as_completed

# Set UTF-8 encoding for stdout on Windows
if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# Concurrency settings
MAX_WORKERS = 10

# MDI download URLs
MDI_REPO_ZIP = "https://github.com/Templarian/MaterialDesign/archive/refs/heads/master.zip"
MDI_VERSION = "7.4.47"  # Track version for updates

# Output paths
WORKSPACE_ROOT = Path(__file__).parent.parent.parent
ICONS_OUTPUT_DIR = WORKSPACE_ROOT / "packages/icons/src/generated"
BUILDER_OUTPUT_DIR = WORKSPACE_ROOT / "packages/builder/generated"
MDI_SVGS_DIR = BUILDER_OUTPUT_DIR / "mdi_svgs"

# Output files
ICON_ENUM_FILE = ICONS_OUTPUT_DIR / "mdi.rs"
METADATA_FILE = BUILDER_OUTPUT_DIR / "mdi_metadata.json"
STYLE_METADATA_FILE = BUILDER_OUTPUT_DIR / "mdi_styles.json"


def download_and_extract_mdi() -> Dict[str, str]:
    """Download and extract MDI SVG files from GitHub"""
    print("Downloading Material Design Icons from GitHub...")

    zip_path = Path("/tmp/mdi.zip")
    meta_path = Path("/tmp/mdi_meta.json")

    # Download the repository zip
    try:
        request = urllib.request.Request(
            MDI_REPO_ZIP,
            headers={'User-Agent': 'Hikari-Icon-Generator/1.0'}
        )
        with urllib.request.urlopen(request, timeout=60) as response:
            with open(zip_path, 'wb') as f:
                f.write(response.read())
        print(f"  OK: Downloaded {zip_path.stat().st_size} bytes")
    except Exception as e:
        print(f"  ERROR: Failed to download: {e}")
        raise

    # Extract SVG files
    print("\nExtracting SVG files...")
    svg_map = {}
    metadata = []

    with zipfile.ZipFile(zip_path, 'r') as zf:
        # Find all SVG files
        svg_files = [f for f in zf.namelist() if f.endswith('.svg') and '/svg/' in f]

        print(f"  Found {len(svg_files)} SVG files")

        # Extract each SVG
        for svg_file in svg_files:
            try:
                # Extract icon name from path (e.g., "MaterialDesign-master/svg/account.svg" -> "account")
                icon_name = svg_file.split('/')[-1].replace('.svg', '')

                # Read SVG content
                svg_content = zf.read(svg_file).decode('utf-8')

                # Determine style
                if icon_name.endswith('-outline'):
                    style = 'outline'
                    base_name = icon_name.replace('-outline', '')
                else:
                    style = 'filled'
                    base_name = icon_name

                svg_map[icon_name] = {
                    'svg': svg_content,
                    'style': style,
                    'base_name': base_name
                }

            except Exception as e:
                print(f"  WARNING: Failed to extract {svg_file}: {e}")

    print(f"  OK: Extracted {len(svg_map)} icons")

    # Extract metadata from meta.json if available
    try:
        with zipfile.ZipFile(zip_path, 'r') as zf:
            meta_files = [f for f in zf.namelist() if f.endswith('meta.json')]
            if meta_files:
                meta_content = zf.read(meta_files[0]).decode('utf-8')
                metadata = json.loads(meta_content)
                print(f"  OK: Loaded metadata for {len(metadata)} icons")
    except Exception as e:
        print(f"  WARNING: Failed to extract metadata: {e}")
        metadata = []

    return svg_map, metadata


def analyze_metadata(svg_map: Dict, metadata: List) -> Dict:
    """Analyze MDI metadata and build style information"""
    print("\nAnalyzing icon metadata...")

    # Build style map
    style_map = {
        'filled': {},
        'outline': {},
        'both': {},
        'outline_only': {},
        'filled_only': {}
    }

    # Track base names
    base_names: Set[str] = set()
    outline_names: Set[str] = set()
    filled_names: Set[str] = set()

    for icon_name, info in svg_map.items():
        base_name = info['base_name']
        style = info['style']

        base_names.add(base_name)
        if style == 'outline':
            outline_names.add(base_name)
        else:
            filled_names.add(base_name)

    # Categorize
    both = outline_names & filled_names
    outline_only = outline_names - filled_names
    filled_only = filled_names - outline_names

    style_map['both'] = {name: [f'{name}', f'{name}-outline'] for name in sorted(both)}
    style_map['outline_only'] = {name: f'{name}-outline' for name in sorted(outline_only)}
    style_map['filled_only'] = {name: name for name in sorted(filled_only)}

    # Build tag map from metadata
    tag_map = {}
    for item in metadata:
        name = item.get('name', '')
        tags = item.get('tags', [])
        if tags:
            tag_map[name] = tags

    # Build alias map
    alias_map = {}
    for item in metadata:
        name = item.get('name', '')
        aliases = item.get('aliases', [])
        if aliases:
            alias_map[name] = aliases

    print(f"  Total icons: {len(svg_map)}")
    print(f"  Icons with both styles: {len(both)}")
    print(f"  Outline-only icons: {len(outline_only)}")
    print(f"  Filled-only icons: {len(filled_only)}")
    print(f"  Tags found: {len(tag_map)}")

    return {
        'style_map': style_map,
        'tag_map': tag_map,
        'alias_map': alias_map,
        'total_icons': len(svg_map)
    }


def generate_icon_enum(svg_map: Dict) -> str:
    """Generate Rust enum with all icon names (no SVG content)"""
    icons = sorted(svg_map.keys())

    output = []
    output.append("// Auto-generated by scripts/icons/fetch_mdi_icons.py")
    output.append(f"// Generated at: {datetime.now().isoformat()}")
    output.append(f"// Total icons: {len(icons)}")
    output.append(f"// MDI Version: {MDI_VERSION}")
    output.append("")
    output.append("#![allow(non_camel_case_types)]")
    output.append("#![allow(non_snake_case)]")
    output.append("#![allow(dead_code)]")
    output.append("")
    output.append("/// Material Design Icon names")
    output.append("///")
    output.append("/// This enum contains all icons from the Material Design Icons library.")
    output.append("/// See: https://pictogrammers.com/library/mdi/")
    output.append("#[derive(Clone, Copy, PartialEq, Eq, Debug, Hash)]")
    output.append("pub enum MdiIcon {")
    output.append("    #[doc(hidden)]")
    output.append("    Unknown,")

    # Enum variants
    for icon in icons:
        variant_name = escape_enum_variant(icon)
        output.append(f"    {variant_name},")

    output.append("}")

    # Display implementation
    output.append("")
    output.append("impl std::fmt::Display for MdiIcon {")
    output.append("    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {")
    output.append("        match self {")
    output.append("            MdiIcon::Unknown => write!(f, \"unknown\"),")

    for icon in icons:
        variant_name = escape_enum_variant(icon)
        output.append(f"            MdiIcon::{variant_name} => write!(f, \"{icon}\"),")

    output.append("        }")
    output.append("    }")
    output.append("}")

    # From<&str> implementation
    output.append("")
    output.append("impl std::convert::From<&str> for MdiIcon {")
    output.append("    fn from(s: &str) -> Self {")
    output.append("        match s {")

    for icon in icons:
        variant_name = escape_enum_variant(icon)
        output.append(f"            \"{icon}\" => MdiIcon::{variant_name},")

    output.append("            _ => MdiIcon::Unknown,")
    output.append("        }")
    output.append("    }")
    output.append("}")

    # Style helper
    output.append("")
    output.append("impl MdiIcon {")
    output.append("    /// Get the style variant of this icon")
    output.append("    pub fn get_variant(&self, style: MdiStyle) -> Option<MdiIcon> {")
    output.append("        let name = self.to_string();")
    output.append("        match style {")
    output.append("            MdiStyle::Filled => {")
    output.append("                if name.ends_with(\"-outline\") {")
    output.append("                    Some(MdiIcon::from(name.replace(\"-outline\", \"\").as_str()))")
    output.append("                } else {")
    output.append("                    Some(*self)")
    output.append("                }")
    output.append("            }")
    output.append("            MdiStyle::Outline => {")
    output.append("                if name.ends_with(\"-outline\") {")
    output.append("                    Some(*self)")
    output.append("                } else {")
    output.append("                    Some(MdiIcon::from(format!(\"{}-outline\", name).as_str()))")
    output.append("                }")
    output.append("            }")
    output.append("        }")
    output.append("    }")
    output.append("}")

    # MdiStyle enum
    output.append("")
    output.append("/// Material Design Icon style")
    output.append("#[derive(Clone, Copy, PartialEq, Eq, Debug, Hash)]")
    output.append("pub enum MdiStyle {")
    output.append("    /// Filled style (default)")
    output.append("    Filled,")
    output.append("    /// Outline style")
    output.append("    Outline,")
    output.append("}")

    return "\n".join(output)


def escape_enum_variant(icon_name: str) -> str:
    """Escape icon name for Rust enum variant (PascalCase)"""
    # Convert kebab-case to PascalCase
    # e.g., "moon-waning-crescent" -> "MoonWaningCrescent"
    parts = icon_name.replace('-outline', '').split('-')
    variant_name = ''.join(p.capitalize() for p in parts)

    # Special case: if the original had -outline, add Outline suffix
    if icon_name.endswith('-outline'):
        variant_name += 'Outline'

    # Rust reserved keywords
    rust_keywords = {
        'Box', 'Match', 'If', 'Else', 'While', 'For', 'Loop', 'Return',
        'Fn', 'Let', 'Mut', 'Const', 'Static', 'Struct', 'Enum', 'Impl',
        'Use', 'Mod', 'Trait', 'Type', 'Where', 'In', 'True', 'False',
        'Move', 'Ref', 'Unsafe', 'Async', 'Await', 'Break', 'Continue',
        'Yield', 'Try', 'Crate', 'Super', 'Self', 'Extern', 'Pub',
        'Type', 'Default',
    }

    if variant_name in rust_keywords:
        return f"r#{variant_name}_"
    return variant_name


def save_svg_files(svg_map: Dict) -> None:
    """Save each SVG as a separate file"""
    print(f"\nSaving SVG files to {MDI_SVGS_DIR}...")
    MDI_SVGS_DIR.mkdir(parents=True, exist_ok=True)

    for icon_name, info in svg_map.items():
        svg_path = MDI_SVGS_DIR / f"{icon_name}.svg"
        with open(svg_path, 'w', encoding='utf-8') as f:
            f.write(info['svg'])

    print(f"  OK: Saved {len(svg_map)} SVG files")


def save_metadata(analysis: Dict, svg_map: Dict) -> None:
    """Save metadata JSON files"""
    print(f"\nSaving metadata...")

    # Full metadata
    metadata = {
        'version': MDI_VERSION,
        'generated_at': datetime.now().isoformat(),
        'total_icons': analysis['total_icons'],
        'icons': {name: {'style': info['style'], 'base_name': info['base_name']}
                  for name, info in svg_map.items()},
        'style_map': analysis['style_map'],
        'tag_map': analysis['tag_map'],
        'alias_map': analysis['alias_map'],
    }

    with open(METADATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(metadata, f, indent=2, ensure_ascii=False)
    print(f"  OK: {METADATA_FILE}")

    # Style metadata for quick lookup
    style_metadata = {
        'by_style': {
            'filled': [name for name, info in svg_map.items() if info['style'] == 'filled'],
            'outline': [name for name, info in svg_map.items() if info['style'] == 'outline'],
        },
        'by_tag': analysis['tag_map'],
        'by_base_name': {},
    }

    # Build by_base_name map
    for name, info in svg_map.items():
        base = info['base_name']
        if base not in style_metadata['by_base_name']:
            style_metadata['by_base_name'][base] = {}
        style_metadata['by_base_name'][base][info['style']] = name

    with open(STYLE_METADATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(style_metadata, f, indent=2, ensure_ascii=False)
    print(f"  OK: {STYLE_METADATA_FILE}")


def main():
    """Main generation workflow"""
    print("=" * 60)
    print("Hikari Material Design Icons Fetcher")
    print("=" * 60)

    # Download and extract
    svg_map, metadata = download_and_extract_mdi()

    # Analyze metadata
    analysis = analyze_metadata(svg_map, metadata)

    # Generate icon enum
    print("\nGenerating icon enum...")
    enum_code = generate_icon_enum(svg_map)

    # Save enum file
    ICONS_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    with open(ICON_ENUM_FILE, 'w', encoding='utf-8') as f:
        f.write(enum_code)
    print(f"  OK: {ICON_ENUM_FILE}")

    # Save SVG files
    save_svg_files(svg_map)

    # Save metadata
    save_metadata(analysis, svg_map)

    # Print summary
    print("\n" + "=" * 60)
    print("SUCCESS!")
    print("=" * 60)
    print(f"Total icons: {len(svg_map)}")
    print(f"\nGenerated files:")
    print(f"  - {ICON_ENUM_FILE}")
    print(f"  - {MDI_SVGS_DIR}/")
    print(f"  - {METADATA_FILE}")
    print(f"  - {STYLE_METADATA_FILE}")
    print(f"\nRust usage:")
    print(f"  use hikari_icons::generated::mdi::MdiIcon;")
    print(f"  use hikari_icons::generated::mdi::MdiStyle;")
    print(f"  ")
    print(f"  let icon = MdiIcon::MoonWaningCrescent;")
    print(f"  let outline = icon.get_variant(MdiStyle::Outline);")
    print("=" * 60)


if __name__ == "__main__":
    main()

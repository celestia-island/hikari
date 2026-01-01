#!/usr/bin/env python3
"""Generate palette files for different platforms from Rust color definitions."""

import re
import json
from pathlib import Path
from typing import Dict, List

# Palette definition (matching src/palette.rs)
PALETTES = {
    "primary": {
        "name": "Primary",
        "description": "Primary color scheme",
        "colors": [
            ("blue-500", "#3B82F6"),
            ("blue-600", "#2563EB"),
            ("blue-50", "#EFF6FF"),
            ("slate-900", "#0F172A"),
            ("slate-50", "#F8FAFC"),
        ]
    },
    "fui-dark": {
        "name": "FUI Dark",
        "description": "Dark theme inspired by Fluent UI",
        "colors": [
            ("purple-500", "#8B5CF6"),
            ("purple-600", "#7C3AED"),
            ("purple-50", "#F5F3FF"),
            ("slate-900", "#0F172A"),
            ("slate-800", "#1E293B"),
        ]
    },
    "arknights": {
        "name": "Arknights",
        "description": "Arknights-inspired dark theme",
        "colors": [
            ("cyan-500", "#06B6D4"),
            ("cyan-600", "#0891B2"),
            ("cyan-50", "#ECFEFF"),
            ("slate-900", "#0F172A"),
            ("slate-800", "#1E293B"),
        ]
    },
    "fresh": {
        "name": "Fresh",
        "description": "Fresh and vibrant color scheme",
        "colors": [
            ("green-500", "#10B981"),
            ("green-600", "#059669"),
            ("green-50", "#ECFDF5"),
            ("slate-900", "#0F172A"),
            ("slate-50", "#F8FAFC"),
        ]
    }
}

def parse_rust_colors(file_path: Path) -> Dict[str, str]:
    """Parse color definitions from colors.rs."""
    colors = {}
    try:
        content = file_path.read_text(encoding='utf-8')
    except UnicodeDecodeError:
        # Fallback to latin-1 if utf-8 fails
        content = file_path.read_text(encoding='latin-1')
    
    # Match color definitions like: pub const NAME: ChineseColor = ChineseColor { hex: "#HEX", ... }
    pattern = r'pub\s+const\s+(\S+):\s+ChineseColor\s*=\s+ChineseColor\s*\{[^}]*hex:\s*"([^"]+)"'
    
    for match in re.finditer(pattern, content):
        name = match.group(1)
        hex_color = match.group(2)
        colors[name] = hex_color
    
    return colors

def generate_css(palette_name: str, palette_data: Dict, output_dir: Path) -> None:
    """Generate CSS variables for a palette."""
    css_lines = [
        f"/* {palette_data['name']} - {palette_data['description']} */",
        f":root[data-theme=\"{palette_name}\"] {{",
    ]
    
    for name, color in palette_data["colors"]:
        var_name = name.replace("-", "_").upper()
        css_lines.append(f"  --hikari-{var_name}: {color};")
    
    css_lines.append("}")
    
    output_file = output_dir / f"{palette_name}.css"
    output_file.write_text("\n".join(css_lines), encoding='utf-8')

def generate_tailwind(palette_name: str, palette_data: Dict, output_dir: Path) -> None:
    """Generate Tailwind config extension for a palette."""
    tailwind_config = {
        palette_name: {}
    }
    
    for name, color in palette_data["colors"]:
        # Handle naming like "blue-500" -> ["blue", "500"]
        parts = name.rsplit("-", 1)
        if len(parts) == 2:
            base_color, shade = parts
            if base_color not in tailwind_config[palette_name]:
                tailwind_config[palette_name][base_color] = {}
            tailwind_config[palette_name][base_color][shade] = color
    
    output_file = output_dir / f"{palette_name}.json"
    output_file.write_text(json.dumps(tailwind_config, indent=2), encoding='utf-8')

def main():
    """Generate all palette files."""
    script_dir = Path(__file__).parent
    colors_file = script_dir / "src" / "colors.rs"
    css_output_dir = script_dir / "data" / "css"
    tailwind_output_dir = script_dir / "data" / "tailwind"
    
    # Create output directories
    css_output_dir.mkdir(parents=True, exist_ok=True)
    tailwind_output_dir.mkdir(parents=True, exist_ok=True)
    
    # Parse Rust colors
    rust_colors = parse_rust_colors(colors_file)
    print(f"Found {len(rust_colors)} colors in colors.rs")
    
    # Generate files for each palette
    for palette_name, palette_data in PALETTES.items():
        print(f"Generating {palette_name} palette...")
        generate_css(palette_name, palette_data, css_output_dir)
        generate_tailwind(palette_name, palette_data, tailwind_output_dir)
    
    print(f"\nSuccessfully generated files in:")
    print(f"  - CSS: {css_output_dir}")
    print(f"  - Tailwind: {tailwind_output_dir}")

if __name__ == "__main__":
    main()

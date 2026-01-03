# Hikari Palette Module Build System
#
# Palette-related build tasks
# Usage:
#   just --justfile scripts/palette.just <recipe>

set windows-shell := ["pwsh.exe", "-NoLogo", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; $PSDefaultParameterValues['*:Encoding'] = 'utf8';"]

# ============================================================================
# Palette build tasks
# ============================================================================

default:
    @just --list

# Generate Chinese color palette from data source
generate:
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @echo "Generating Chinese color palette..."
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    python scripts/palette/generate_palette.py
    #!pwsh
    if ($PSScriptRoot) { Set-Location (Split-Path $PSScriptRoot -Parent) }
    python scripts/palette/generate_palette.py

# Fetch: same as generate (for consistency with other modules)
fetch: generate

# Build palette package with generated colors
build: generate
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @echo "Building hikari-palette package..."
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    cargo build -p hikari-palette

# Rebuild palette from scratch
rebuild: generate
    @cargo clean -p hikari-palette
    @cargo build -p hikari-palette

# ============================================================================
# Development tasks
# ============================================================================

# Build palette in debug mode
dev: generate
    @cargo build -p hikari-palette

# Run palette tests
test:
    @cargo test -p hikari-palette

# Run Clippy on palette package
clippy:
    @cargo clippy -p hikari-palette --all-targets -- -D warnings

# Format palette code
fmt:
    @cargo fmt -p hikari-palette

# ============================================================================
# Utilities
# ============================================================================

# Check if palette colors need to be regenerated
check:
    @echo "Checking Chinese color palette..."
    @if (!(Test-Path "packages/palette/src/colors.rs")) { echo "❌ Palette colors not generated"; exit 1 } else { echo "✅ Palette colors exist" }

# Show available color categories
categories:
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @echo "Chinese Color Categories"
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @echo "  - Red (红色系)"
    @echo "  - Orange (橙色系)"
    @echo "  - Yellow (黄色系)"
    @echo "  - Green (绿色系)"
    @echo "  - Cyan (青色系)"
    @echo "  - Blue (蓝色系)"
    @echo "  - Purple (紫色系)"
    @echo "  - White (白色系)"
    @echo "  - Black (黑色系)"
    @echo "  - Gray (灰色系)"

# Show popular colors
popular:
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @echo "Popular Chinese Colors"
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @echo "  主色:"
    @echo "    - 石青 #1759A8 (Blue)"
    @echo "    - 朱砂 #FF4C00 (Red)"
    @echo "    - 藤黄 #FFB800 (Yellow)"
    @echo "    - 靛蓝 #1A237E (Deep Blue)"
    @echo ""
    @echo "  中性色:"
    @echo "    - 月白 #D6ECF0 (Off White)"
    @echo "    - 墨色 #333333 (Ink Black)"
    @echo "    - 缟色 #8B954F (Light Gray)"
    @echo ""
    @echo "  功能色:"
    @echo "    - 葱倩 #5CBF91 (Success Green)"
    @echo "    - 鹅黄 #FBC02D (Warning Yellow)"
    @echo "    - 朱砂 #FF4C00 (Danger Red)"

# Show palette build status
status:
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @echo "Palette Module Status"
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @just check
    @echo ""
    @echo "Palette package: hikari-palette"
    @echo "Output: packages/palette/src/colors.rs"
    @echo "Script: scripts/palette/generate_palette.py"
    @echo ""
    @just categories

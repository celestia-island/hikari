# Hikari Theme Module Build System
#
# Theme-related build tasks
# Usage:
#   just --justfile scripts/theme.just <recipe>

set windows-shell := ["pwsh.exe", "-NoLogo", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; $PSDefaultParameterValues['*:Encoding'] = 'utf8';"]

# ============================================================================
# Theme build tasks
# ============================================================================

default:
    @just --list

# Fetch Tailwind CSS from CDN and generate Rust module
fetch:
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @echo "Fetching Tailwind CSS from CDN..."
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    python scripts/theme/fetch_tailwindcss.py

# Build theme with Tailwind CSS
build: fetch
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @echo "Building hikari-theme package..."
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    cargo build -p hikari-theme

# Rebuild theme from scratch
rebuild: fetch
    @cargo clean -p hikari-theme
    @cargo build -p hikari-theme

# Watch theme for changes (placeholder for future development)
watch:
    @echo "Watch mode not yet implemented for theme"
    @echo "Use 'just rebuild' to rebuild after changes"

# ============================================================================
# Development tasks
# ============================================================================

# Build theme in debug mode
dev: fetch
    @cargo build -p hikari-theme

# Run theme tests
test:
    @cargo test -p hikari-theme

# Run Clippy on theme package
clippy:
    @cargo clippy -p hikari-theme --all-targets -- -D warnings

# Format theme code
fmt:
    @cargo fmt -p hikari-theme

# ============================================================================
# Utilities
# ============================================================================

# Check if Tailwind CSS needs to be regenerated
check:
    @echo "Checking Tailwind CSS..."
    @if (!(Test-Path "packages/theme/src/generated/tailwind.rs")) { echo "❌ Tailwind CSS not generated"; exit 1 } else { echo "✅ Tailwind CSS exists" }

# Show theme build status
status:
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @echo "Theme Module Status"
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @just check
    @echo ""
    @echo "Theme package: hikari-theme"
    @echo "Output: packages/theme/src/generated/tailwind.rs"
    @echo "Script: scripts/theme/fetch_tailwindcss.py"

# Hikari Icons Module Build System
#
# Icons-related build tasks
# Usage:
#   just --justfile scripts/icons.just <recipe>

set windows-shell := ["pwsh.exe", "-NoLogo", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; $PSDefaultParameterValues['*:Encoding'] = 'utf8';"]

py := if os_family() == "windows" { "python" } else { "python3" }

# ============================================================================
# Icons build tasks
# ============================================================================

default:
    @just --list

# Fetch Lucide icons from GitHub and generate Rust module
fetch:
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @echo "Fetching Lucide icons from GitHub..."
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    {{py}} scripts/icons/fetch_lucide_icons.py

# Generate Lucide icons enum (legacy script, use fetch instead)
enum:
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @echo "Generating Lucide icons enum..."
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @echo "Note: This is the legacy script, use 'fetch' instead"
    {{py}} scripts/icons/generate_lucide_icons.py

# Build Lucide icon assets (legacy script)
assets:
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @echo "Building Lucide icon assets..."
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    {{py}} scripts/icons/build_lucide_assets.py

# Generate all icon resources
all: fetch
    @echo "✅ All icon resources generated"

# Build icons package with generated resources
build: fetch
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @echo "Building hikari-icons package..."
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    cargo build -p hikari-icons

# Rebuild icons from scratch
rebuild: fetch
    @cargo clean -p hikari-icons
    @cargo build -p hikari-icons

# ============================================================================
# Development tasks
# ============================================================================

# Build icons in debug mode
dev: fetch
    @cargo build -p hikari-icons

# Run icons tests
test:
    @cargo test -p hikari-icons

# Run Clippy on icons package
clippy:
    @cargo clippy -p hikari-icons --all-targets -- -D warnings

# Format icons code
fmt:
    @cargo fmt -p hikari-icons

# ============================================================================
# Utilities
# ============================================================================

# Check if icons need to be regenerated
check:
    @echo "Checking Lucide icons..."
    @{{py}} -c "from pathlib import Path; p = Path('packages/icons/src/generated/lucide.rs'); print('✅ Lucide icons exist') if p.exists() else (print('❌ Lucide icons not generated'), exit(1))"

# List available icons
list:
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @echo "Available Lucide Icons"
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @{{py}} scripts/icons/list_icons.py

# Show icons build status
status:
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @echo "Icons Module Status"
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @just check
    @echo ""
    @echo "Icons package: hikari-icons"
    @echo "Output: packages/icons/src/generated/lucide.rs"
    @echo "Script: scripts/icons/fetch_lucide_icons.py"
    @just list

# Hikari Build System
#
# Usage:
#   just <recipe>        - Run specified recipe
#   just --list          - List all available recipes
#   just --summary       - Briefly list all recipe names
#
# Main tasks:
#   just dev             - Development mode (build and start demo-app)
#   just build           - Build everything (Release)
#   just build-dev       - Build everything (Debug)
#   just fmt             - Format code
#   just clippy          - Run Clippy checks
#   just clean           - Clean build artifacts

# Configure Windows to use PowerShell (UTF-8 encoding)
set windows-shell := ["pwsh.exe", "-NoLogo", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; $PSDefaultParameterValues['*:Encoding'] = 'utf8';"]

# ============================================================================
# Core tasks
# ============================================================================

default:
    @just --list

# ============================================================================
# Infrastructure setup
# ============================================================================

# Complete build (Debug mode)
build-dev:
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @echo "Building all (Debug mode)..."
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    cargo build --workspace

# Complete build (Release mode)
build:
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @echo "Building all (Release mode)..."
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    cargo build --workspace --release

# ============================================================================
# Examples
# ============================================================================

# Development mode (build and start demo-app)
dev:
    @echo ""
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @echo "Building workspace..."
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    cargo build
    @echo ""
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @echo "Running demo-app..."
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    cd examples/demo-app && cargo run --features="server"

# Run demo-app (one-click start, alias for dev)
run-demo: dev

# ============================================================================
# Code quality
# ============================================================================

# Format code
fmt:
    cargo fmt --all

# Check formatting
fmt-check:
    @echo "Checking code formatting..."
    cargo fmt --all -- --check

# Run Clippy
clippy:
    @echo "Running Clippy..."
    cargo clippy --workspace --all-targets -- -D warnings

# Full check (format + clippy)
check: fmt-check clippy
    @echo "✅ All checks passed"

# ============================================================================
# Testing
# ============================================================================

# Run tests
test:
    cargo test --workspace

# ============================================================================
# Cleanup
# ============================================================================

# Clean all build artifacts
clean:
    cargo clean
    @echo "🧹 Cleaned all build artifacts"

# ============================================================================
# Utilities
# ============================================================================

# Update dependencies
update:
    @echo "Updating dependencies..."
    cargo update

# Show project information
info:
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @echo "Hikari Build System"
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @rustc --version
    @cargo --version
    @just --version
    @echo ""
    @echo "Packages:"
    @echo "  hikari-core"
    @echo "  hikari-palette"
    @echo "  hikari-theme"
    @echo "  hikari-icons"
    @echo "  hikari-components"
    @echo "  hikari-extra-components"
    @echo "  hikari-ssr"
    @echo "  _dev-tools"
    @echo ""
    @echo "Examples:"
    @echo "  demo-app (unified demo app with all examples)"

# ============================================================================
# Module Pre-build Scripts (Python-based)
# ============================================================================

# Generate all static assets (Theme + Icons + Palette)
generate-all:
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @echo "Generating all static assets..."
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @python scripts/palette/generate_palette.py
    @python scripts/theme/fetch_tailwindcss.py
    @python scripts/icons/fetch_lucide_icons.py
    @echo "All static assets generated"

# Generate Chinese color palette
generate-palette:
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @echo "Generating Chinese color palette..."
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @python scripts/palette/generate_palette.py

# Generate Tailwind CSS bundle
generate-tailwind:
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @echo "Fetching Tailwind CSS..."
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @python scripts/theme/fetch_tailwindcss.py

# Generate Lucide Icons enum and SVGs
generate-lucide:
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @echo "Generating Lucide icons..."
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @python scripts/icons/fetch_lucide_icons.py

# ============================================================================
# Module-specific shortcuts
# ============================================================================

# Theme module commands
theme *args:
    @just --justfile scripts/theme.just {{args}}

# Icons module commands
icons *args:
    @just --justfile scripts/icons.just {{args}}

# Palette module commands
palette *args:
    @just --justfile scripts/palette.just {{args}}

# Build with all generated assets
build-generated: generate-all
    @cargo build --workspace

# ============================================================================
# Feature-specific builds
# ============================================================================

# Build with all generated static assets
build-features: generate-all
    @cargo build --workspace --release

# ============================================================================
# Installation
# ============================================================================

# Install Rust dependencies
install:
    @echo "Installing Rust dependencies..."
    @cargo fetch
    @echo "✅ All dependencies installed!"

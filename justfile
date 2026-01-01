# Hikari Build System
#
# Usage:
#   just <recipe>        - Run specified recipe
#   just --list          - List all available recipes
#   just --summary       - Briefly list all recipe names
#
# Main tasks:
#   just build           - Build everything (Release)
#   just build-dev       - Build everything (Debug)
#   just dev             - Development mode (build and start demo-app)
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

# Run demo-app (one-click start)
run-demo: build-dev
    @echo ""
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @echo "Running demo-app..."
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    cargo run -p demo-app --bin demo-app

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
    @echo "  demo-app"
    @echo "  table-demo"
    @echo "  tree-demo"
    @echo "  node-graph-demo"
    @echo "  ssr-demo"

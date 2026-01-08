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
#   just dev             - Development mode (build and start website)
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
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
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

# Check if port 3000 is occupied (standalone command)
check-port:
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @echo "Checking port 3000..."
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @python scripts/utils/clean_process.py

# Build website WASM client (debug mode)
# Note: build.rs will automatically compile SCSS and copy assets to public/
build-client:
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @echo "Building website WASM client..."
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @echo "Step 1: Build hikari-builder to generate CSS bundle"
    @cargo build --package hikari-builder
    @echo "Step 2: Build WASM library (triggers build.rs to copy index.html and logo)"
    @cargo build --lib --target wasm32-unknown-unknown --manifest-path examples/website/Cargo.toml
    @echo ""
    @echo "🔧 Binding WASM..."
    @wasm-bindgen --target web --out-dir public/assets --no-typescript examples/website/target/wasm32-unknown-unknown/debug/website.wasm
    @echo ""
    @echo "✅ WASM client built successfully"
    @echo ""
    @echo "📦 Output: public/"

# Development mode for website (build WASM client and start server)
dev:
    # Step 1: Check and clean port 3000
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @echo "Checking port 3000..."
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @python scripts/utils/clean_process.py
    @echo ""

    # Step 2: Build WASM client
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @echo "Building website WASM client..."
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @echo "Step 1: Build hikari-builder to generate CSS bundle"
    @cargo build --package hikari-builder
    @echo "Step 2: Build WASM library (triggers build.rs to copy index.html and logo)"
    @cargo build --lib --target wasm32-unknown-unknown --manifest-path examples/website/Cargo.toml
    @echo ""
    @echo "🔧 Binding WASM..."
    @wasm-bindgen --target web --out-dir public/assets --no-typescript examples/website/target/wasm32-unknown-unknown/debug/website.wasm
    @echo ""
    @echo "✅ WASM client built successfully"
    @echo ""

    # Step 3: Start server
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @echo "Starting website server..."
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @echo "🌐 Server will be available at: http://localhost:3000"
    @echo ""
    @echo "Press Ctrl+C to stop the server"
    @echo ""
    cargo run --manifest-path examples/website/Cargo.toml --features server

# Alias for dev
serve: dev

# Development mode with file watching (auto-rebuild on changes)
# Requires: cargo install cargo-watch
watch:
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @echo "Starting watch mode..."
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @echo "👀 Watching for changes in:"
    @echo "   - Rust source files (*.rs)"
    @echo "   - SCSS files (*.scss)"
    @echo "   - HTML files (*.html)"
    @echo "   - Cargo.toml files"
    @echo ""
    @echo "🔄 Will automatically rebuild and restart on file changes"
    @echo "Press Ctrl+C to stop"
    @echo ""
    @python scripts/utils/clean_process.py
    @cargo watch \
        --clear \
        --watch packages \
        --watch examples/website/src \
        --watch examples/website/index.html \
        --watch examples/website/Cargo.toml \
        --ignore '*/target/*' \
        --ignore '*/generated/*' \
        --shell 'just build-watch-internal'

# Advanced watch mode with parallel server (recommended for development)
# Auto-rebuilds WASM and restarts server on file changes
watch-dev:
    @python scripts/build/watch_dev.py

# Internal: Watch mode build step (called by cargo-watch)
build-watch-internal:
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @echo "🔨 Rebuilding... [$(Get-Date -Format 'HH:mm:ss')]"
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @cargo build --package hikari-builder
    @cargo build --lib --target wasm32-unknown-unknown --manifest-path examples/website/Cargo.toml
    @wasm-bindgen --target web --out-dir public/assets --no-typescript examples/website/target/wasm32-unknown-unknown/debug/website.wasm 2>$null
    @echo "✅ Build complete - server will restart automatically"

# Run website (one-click start, no WASM rebuild)
run:
    # Step 1: Check and clean port 3000
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @echo "Checking port 3000..."
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @python scripts/utils/clean_process.py
    @echo ""

    # Step 2: Start server
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @echo "Starting website server (skipping WASM build)..."
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @echo "🌐 Server will be available at: http://localhost:3000"
    @echo ""
    @echo "Press Ctrl+C to stop the server"
    @echo ""
    cargo run --manifest-path examples/website/Cargo.toml --features server

# ============================================================================
# Code quality
# ============================================================================

# Format code with rustfmt
fmt:
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @echo "Formatting code..."
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @cargo fmt --all

# Run Clippy checks
clippy:
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @echo "Running Clippy checks..."
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @cargo clippy --all-targets --all-features -- -D warnings

# ============================================================================
# Cleaning
# ============================================================================

# Clean build artifacts
clean:
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @echo "Cleaning build artifacts..."
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @cargo clean
    @if (Test-Path examples/website/public) { Remove-Item -Recurse -Force examples/website/public }
    @if (Test-Path examples/website/dist) { Remove-Item -Recurse -Force examples/website/dist }
    @if (Test-Path packages/builder/src/generated) { Remove-Item -Recurse -Force packages/builder/src/generated }
    @echo "✅ Clean completed"

# Clean only old dist/ directories (migrated to public/)
clean-dist:
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @echo "Cleaning old dist/ directories..."
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @Get-ChildItem -Path . -Recurse -Directory -Filter "dist" | Remove-Item -Recurse -Force
    @echo "✅ Old dist/ directories removed"

# ============================================================================
# Testing
# ============================================================================

# Run all tests
test:
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @echo "Running tests..."
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @cargo test --workspace

# Run tests with output
test-verbose:
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @echo "Running tests (verbose)..."
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @cargo test --workspace -- --nocapture

# ============================================================================
# Utilities
# ============================================================================

# Update dependencies
update:
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @echo "Updating dependencies..."
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @cargo update

# Check for outdated dependencies
outdated:
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @echo "Checking for outdated dependencies..."
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @cargo outdated

# Generate SCSS bundle manually (for debugging)
generate-scss:
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @echo "Generating SCSS bundle..."
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @cargo build --manifest-path packages/builder/Cargo.toml

# Generate bulk import mod.rs files for website
generate-imports:
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @echo "Generating bulk import files..."
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @python scripts/generate_bulk_imports.py

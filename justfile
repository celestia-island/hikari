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
#   just dev-by-agent    - Start dev server and exit when ready (for AI agent)
#   just fmt             - Format code
#   just clippy          - Run Clippy checks
#   just clean           - Clean build artifacts

# Windows uses PowerShell with UTF-8 encoding
set windows-shell := ["pwsh.exe", "-NoLogo", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; $PSDefaultParameterValues['*:Encoding'] = 'utf8';"]

# Python command (platform adaptive)
py := if os_family() == "windows" { "python" } else { "python3" }

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
    @{{py}} scripts/utils/clean_process.py

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
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @echo "Checking port 3000..."
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @{{py}} scripts/utils/clean_process.py
    @echo ""
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
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @echo "Starting website server..."
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @echo "🌐 Server will be available at: http://localhost:3000"
    @echo ""
    @echo "Press Ctrl+C to stop the server"
    @echo ""
    @cargo run --manifest-path examples/website/Cargo.toml --features server

# Start dev server and exit when ready (for AI agent)
# This starts the dev server in background and exits when it's listening on port 3000
dev-by-agent:
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @echo "Starting dev server (agent mode)..."
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @{{py}} scripts/build/dev_by_agent.py

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
    @{{py}} scripts/utils/clean_process.py
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
    @{{py}} scripts/build/watch_dev.py

# Internal: Watch mode build step (called by cargo-watch)
build-watch-internal:
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @echo "🔨 Rebuilding..."
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @cargo build --package hikari-builder
    @cargo build --lib --target wasm32-unknown-unknown --manifest-path examples/website/Cargo.toml
    @wasm-bindgen --target web --out-dir public/assets --no-typescript examples/website/target/wasm32-unknown-unknown/debug/website.wasm 2>/dev/null || true
    @echo "✅ Build complete - server will restart automatically"

# Run website (one-click start, no WASM rebuild)
run:
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @echo "Checking port 3000..."
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @{{py}} scripts/utils/clean_process.py
    @echo ""
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @echo "Starting website server (skipping WASM build)..."
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @echo "🌐 Server will be available at: http://localhost:3000"
    @echo ""
    @echo "Press Ctrl+C to stop the server"
    @echo ""
    @cargo run --manifest-path examples/website/Cargo.toml --features server

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
# Cleaning (cross-platform)
# ============================================================================

# Clean build artifacts
[linux]
clean:
    @bash -c "echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'; echo 'Cleaning build artifacts...'; cargo clean; rm -rf examples/website/public examples/website/dist packages/builder/src/generated public 2>/dev/null || true; echo '✅ Clean completed'"

[windows]
clean:
    @pwsh.exe -NoLogo -Command "echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'; echo 'Cleaning build artifacts...'; cargo clean; if (Test-Path examples/website/public) { Remove-Item -Recurse -Force examples/website/public }; if (Test-Path examples/website/dist) { Remove-Item -Recurse -Force examples/website/dist }; if (Test-Path packages/builder/src/generated) { Remove-Item -Recurse -Force packages/builder/src/generated }; if (Test-Path public) { Remove-Item -Recurse -Force public }; echo '✅ Clean completed'"

# Clean only old dist/ directories (migrated to public/)
[linux]
clean-dist:
    @bash -c "echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'; echo 'Cleaning old dist/ directories...'; find . -type d -name 'dist' -exec rm -rf {} + 2>/dev/null || true; echo '✅ Old dist/ directories removed'"

[windows]
clean-dist:
    @pwsh.exe -NoLogo -Command "echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'; echo 'Cleaning old dist/ directories...'; Get-ChildItem -Path . -Recurse -Directory -Filter 'dist' -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force; echo '✅ Old dist/ directories removed'"

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

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

# External packager from sibling repository (tairitsu)
tairitsu_packager_manifest := "../tairitsu/packages/packager/Cargo.toml"
website_manifest := "examples/website/Cargo.toml"

# ============================================================================
# Core tasks
# ============================================================================

default:
    @just --list

# ============================================================================
# Infrastructure setup
# ============================================================================

# Check that tairitsu-packager is available from sibling repository
check-tairitsu-packager:
    @{{py}} -c "import pathlib,sys; p=pathlib.Path('{{tairitsu_packager_manifest}}'); sys.exit(0) if p.exists() else (print(f'[ERROR] Missing tairitsu-packager: {p}'), sys.exit(1))"

# Complete build (Debug mode)
build-dev:
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @echo "Fetching MDI icons..."
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @{{py}} scripts/icons/fetch_mdi_icons.py
    @echo ""
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @echo "Compiling website SCSS assets..."
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @{{py}} scripts/build/compile_scss.py
    @echo ""
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @echo "Building all (Debug mode)..."
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    cargo build --workspace

# Complete build (Release mode)
build:
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @echo "Building all (Release mode)..."
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @{{py}} scripts/build/compile_scss.py
    cargo build --workspace --release

# Build website with tairitsu-packager (production output to public/)
build-website:
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @echo "Fetching MDI icons..."
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @{{py}} scripts/icons/fetch_mdi_icons.py
    @echo ""
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @echo "Compiling website SCSS assets..."
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @{{py}} scripts/build/compile_scss.py
    @echo ""
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @echo "Building website with tairitsu-packager..."
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @just check-tairitsu-packager
    @cd examples/website && cargo run --manifest-path ../../../tairitsu/packages/packager/Cargo.toml -- --manifest-path Cargo.toml build

# ============================================================================
# Examples
# ============================================================================

# Check if port 3000 is occupied (standalone command)
check-port *force="":
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @echo "Checking port 3000..."
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @{{py}} scripts/utils/clean_process_linux.py {{force}}

# Build website WASM client (debug mode)
# Note: website source assets are staged under examples/website/public and
# tairitsu-packager emits the final site to root public/

# Development mode for website (migrated to tairitsu-packager component pipeline)
dev *force="":
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @echo "Checking port 3000..."
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @{{py}} scripts/utils/clean_process_linux.py {{force}}
    @echo ""
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @echo "Fetching MDI icons..."
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @{{py}} scripts/icons/fetch_mdi_icons.py
    @echo ""
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @echo "Compiling website SCSS assets..."
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @{{py}} scripts/build/compile_scss.py
    @echo ""
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @echo "Running tairitsu-packager dev pipeline..."
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @just check-tairitsu-packager
    @cd examples/website && cargo run --manifest-path ../../../tairitsu/packages/packager/Cargo.toml -- --manifest-path Cargo.toml dev --port 3000 --watch

# Start dev server and exit when ready (for AI agent)
# This starts the dev server in background and exits when it's listening on port 3000
dev-by-agent:
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @echo "Starting dev server (agent mode, tairitsu-packager)..."
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @just check-tairitsu-packager
    @{{py}} scripts/build/compile_scss.py
    @cd examples/website && cargo run --manifest-path ../../../tairitsu/packages/packager/Cargo.toml -- --manifest-path Cargo.toml dev --port 3000

# Alias for dev
serve: dev

# Development mode with file watching (auto-rebuild on changes)
# Requires: cargo install cargo-watch
watch:
    @just dev

# Advanced watch mode with parallel server (recommended for development)
# Auto-rebuilds WASM and restarts server on file changes
watch-dev:
    @just dev

run: dev

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
    @bash -c "echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'; echo 'Cleaning build artifacts...'; cargo clean; rm -rf examples/website/dist packages/builder/src/generated public 2>/dev/null || true; echo '✅ Clean completed'"

[windows]
clean:
    @pwsh.exe -NoLogo -Command "echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'; echo 'Cleaning build artifacts...'; cargo clean; if (Test-Path examples/website/dist) { Remove-Item -Recurse -Force examples/website/dist }; if (Test-Path packages/builder/src/generated) { Remove-Item -Recurse -Force packages/builder/src/generated }; if (Test-Path public) { Remove-Item -Recurse -Force public }; echo '✅ Clean completed'"

# Clean only old dist/ directories (migrated to public/)
[linux]
clean-dist:
    @bash -c "echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'; echo 'Cleaning old dist/ directories...'; find . -type d -name 'dist' -exec rm -rf {} + 2>/dev/null || true; echo '✅ Old dist/ directories removed'"

[windows]
clean-dist:
    @pwsh.exe -NoLogo -Command "echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'; echo 'Cleaning old dist/ directories...'; Get-ChildItem -Path . -Recurse -Directory -Filter 'dist' -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force; echo '✅ Old dist/ directories removed'"
# ============================================================================

# E2E Testing
# ============================================================================

# Run E2E screenshots in parallel (8 containers)
e2e-parallel:
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @echo "Running E2E screenshot test in parallel..."
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @./scripts/run_parallel_screenshots.sh
    @echo ""
    @echo "Screenshots saved to: target/e2e_screenshots/"
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Test specific route (for debugging)
e2e-test route="":
    @echo "Testing single route: {{route}}..."
    @docker run --rm --network host -v "$(pwd)/target/e2e_screenshots:/tmp/e2e_screenshots" -v "$(pwd)/public:/public:ro" hikari/screenshot:selenium /usr/local/bin/hikari-screenshot --start "{{route}}" --end "{{route}}" > /dev/null

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
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @echo "Generating SCSS bundle..."
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @cargo build --manifest-path packages/builder/Cargo.toml

# ============================================================================
# Interactive Browser Debug (for AI agents)
# ============================================================================

# Build browser debug tool
build-debug:
    @cargo build --release --package hikari-e2e --bin hikari-browser-debug

# Capture screenshot of a page (for AI visual analysis)
debug-screenshot url="http://localhost:3000" output="screenshot.png" wait="10" inject="":
    @{{py}} scripts/dev/browser_debug.py screenshot --url "{{url}}" --output "{{output}}" --wait {{wait}} {{if inject != "" { "--inject " + inject } else { "" } }}

# Check if page is properly loaded
debug-check url="http://localhost:3000" wait="10":
    @{{py}} scripts/dev/browser_debug.py check --url "{{url}}" --wait {{wait}}

# Execute JavaScript and get result
debug-script url="http://localhost:3000" script="return document.title;" wait="10":
    @{{py}} scripts/dev/browser_debug.py script --url "{{url}}" --script '{{script}}' --wait {{wait}}

# Run interactive debug commands from JSON file
debug-interactive input="scripts/dev/commands/example_commands.json":
    @{{py}} scripts/dev/browser_debug.py interactive --input "{{input}}" --output-dir scripts/dev/screenshots

# Quick visual check - capture key pages
debug-visual-check:
    @{{py}} scripts/dev/browser_debug.py interactive --input "scripts/dev/commands/example_commands.json" --output-dir scripts/dev/screenshots

# Generate commands file from routes
debug-generate *routes:
    @{{py}} scripts/dev/browser_debug.py generate --routes {{routes}} --output "scripts/dev/commands/generated.json" --base-url "http://localhost:3000"

# Full debug session for a route
debug-session route="/":
    @{{py}} scripts/dev/browser_debug.py screenshot \
        --url "http://localhost:3000{{route}}" \
        --output "debug.png" \
        --wait 10

# Start Chrome debug container (VNC on 5900, noVNC on 7900)
debug-chrome-up:
    @docker compose -f docker/docker-compose.debug.yml up -d chrome-debug
    @echo "Chrome debug container started"
    @echo "  - VNC: vnc://localhost:5900 (no password)"
    @echo "  - noVNC: http://localhost:7900"

debug-chrome-down:
    @docker compose -f docker/docker-compose.debug.yml down

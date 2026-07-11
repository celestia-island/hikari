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

# Windows uses Git Bash (not PowerShell/WSL — neither has cargo on PATH).
set windows-shell := ["pwsh.exe", "-NoLogo", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; $PSDefaultParameterValues['*:Encoding'] = 'utf8';"]
set shell := ["bash", "-c"]
# `set lists` enables which() (used by the imported celestia-devtools.just);
# `set unstable` gates it.
set unstable
set lists

# Python command (platform adaptive)
py := if os_family() == "windows" { "python" } else { "python3" }

# External packager from sibling repository (tairitsu)
tairitsu_packager_manifest := "../tairitsu/packages/packager/Cargo.toml"
website_manifest := "examples/website/Cargo.toml"
# Lagrange SSG binary — resolved via celestia-devtools locate (checks env
# vars, cargo [patch] config, sibling dir, git clone). Falls back to the
# standard sibling layout ../lagrange if devtools isn't installed.
lagrange_root := `celestia-devtools locate --crate lagrange 2>/dev/null || python -m celestia_devtools locate --crate lagrange 2>/dev/null || echo "../lagrange"`
lagrange_bin := lagrange_root + if os_family() == "windows" { "/target/release/lagrange.exe" } else { "/target/release/lagrange" }

# ============================================================================
# Core tasks
# ============================================================================

import "./celestia-devtools.just"

default:
    @just --list

# ============================================================================
# Infrastructure setup
# ============================================================================

# Check that tairitsu-packager is available from sibling repository
check-tairitsu-packager:
    @{{py}} -c "import pathlib,sys; p=pathlib.Path('{{tairitsu_packager_manifest}}'); sys.exit(0) if p.exists() else (print(f'[ERROR] Missing tairitsu-packager: {p}'), sys.exit(1))"

# Fetch MDI icons (optional - tairitsu will also handle this)
fetch-icons:
    @echo "  →  Fetching MDI icons..."
    @{{py}} scripts/icons/fetch_mdi_icons.py 2>&1 | grep -E "(OK:|ERROR:|WARNING:)" || true

# ============================================================================
# Build tasks
# ============================================================================

# Complete build (Debug mode)
build-dev: fetch-icons
    @echo "  →  Building workspace (Debug)..."
    @cargo build --workspace

# Complete build (Release mode)
build: fetch-icons
    @echo "  →  Building workspace (Release)..."
    @cargo build --workspace --release

# Build website with tairitsu-packager (production output to public/)
build-website: _check-lagrange
    @echo "  ╭──────────────────────────────────────────────────╮"
    @echo "  │  Building docs with lagrange SSG                 │"
    @echo "  ╰──────────────────────────────────────────────────╯"
    {{lagrange_bin}} build --src docs --out dist

# ============================================================================
# Development
# ============================================================================

# Verify the lagrange binary exists, with a helpful error if not.
_check-lagrange:
    @test -f "{{lagrange_bin}}" || { echo "[ERROR] lagrange not built: {{lagrange_bin}}"; echo "  Run: cd {{lagrange_root}} && cargo build --release"; exit 1; }

# Development mode: build docs with lagrange + serve with watch
dev: _check-lagrange
    {{lagrange_bin}} dev --src docs --out dist --port 3000

# Start dev server (no watch, for AI agent)
dev-by-agent: _check-lagrange
    {{lagrange_bin}} build --src docs --out dist
    {{lagrange_bin}} dev --src docs --out dist --port 3000 --interval 999

# Alias for dev
serve: dev

# Development mode with file watching
watch:
    @just dev

watch-dev:
    @just dev

run: dev

# ============================================================================
# Code quality
# ============================================================================

# Format code with rustfmt
fmt:
    @echo "  →  Formatting code..."
    @cargo fmt --all

# Run Clippy checks
clippy:
    @echo "  →  Running Clippy..."
    @cargo clippy --all-targets --all-features -- -D warnings

# ============================================================================
# Cleaning
# ============================================================================

# Clean build artifacts
[linux]
clean:
    @echo "  →  Cleaning..."
    @cargo clean 2>/dev/null || true
    @rm -rf examples/website/dist packages/builder/src/generated public 2>/dev/null || true
    @echo "  ✓  Clean completed"

[windows]
clean:
    @pwsh.exe -NoLogo -Command "echo '  →  Cleaning...'; cargo clean; if (Test-Path examples/website/dist) { Remove-Item -Recurse -Force examples/website/dist }; if (Test-Path packages/builder/src/generated) { Remove-Item -Recurse -Force packages/builder/src/generated }; if (Test-Path public) { Remove-Item -Recurse -Force public }; echo '  ✓  Clean completed'"

# ============================================================================
# E2E Testing
# ============================================================================

# Run E2E screenshots in parallel
e2e-parallel:
    @echo "  →  Running E2E tests..."
    @./scripts/run_parallel_screenshots.sh
    @echo "  ✓  Screenshots saved to: target/e2e_screenshots/"

# Test specific route
e2e-test route="":
    @docker run --rm --network host -v "$(pwd)/target/e2e_screenshots:/tmp/e2e_screenshots" -v "$(pwd)/public:/public:ro" hikari/screenshot:selenium /usr/local/bin/hikari-screenshot --start "{{route}}" --end "{{route}}" > /dev/null

# ============================================================================
# Unit Testing
# ============================================================================

# Run all tests
test:
    @echo "  →  Running tests..."
    @cargo test --workspace

# Run tests with output
test-verbose:
    @cargo test --workspace -- --nocapture

# ============================================================================
# Utilities
# ============================================================================

# Update dependencies
update:
    @echo "  →  Updating dependencies..."
    @cargo update

# Generate SCSS bundle manually
generate-scss:
    @cargo build --manifest-path packages/builder/Cargo.toml

# ============================================================================
# Browser Debug (for AI agents)
# ============================================================================

build-debug:
    @cargo build --release --package hikari-e2e --bin hikari-browser-debug

debug-screenshot url="http://localhost:3000" output="screenshot.png" wait="10" inject="":
    @{{py}} scripts/dev/browser_debug.py screenshot --url "{{url}}" --output "{{output}}" --wait {{wait}} {{if inject != "" { "--inject " + inject } else { "" } }}

debug-check url="http://localhost:3000" wait="10":
    @{{py}} scripts/dev/browser_debug.py check --url "{{url}}" --wait {{wait}}

debug-script url="http://localhost:3000" script="return document.title;" wait="10":
    @{{py}} scripts/dev/browser_debug.py script --url "{{url}}" --script '{{script}}' --wait {{wait}}

debug-interactive input="scripts/dev/commands/example_commands.json":
    @{{py}} scripts/dev/browser_debug.py interactive --input "{{input}}" --output-dir scripts/dev/screenshots

debug-visual-check:
    @{{py}} scripts/dev/browser_debug.py interactive --input "scripts/dev/commands/example_commands.json" --output-dir scripts/dev/screenshots

debug-session route="/":
    @{{py}} scripts/dev/browser_debug.py screenshot --url "http://localhost:3000{{route}}" --output "debug.png" --wait 10

debug-chrome-up:
    @docker compose -f docker/docker-compose.debug.yml up -d chrome-debug
    @echo "  - VNC: vnc://localhost:5900"
    @echo "  - noVNC: http://localhost:7900"

debug-chrome-down:
    @docker compose -f docker/docker-compose.debug.yml down

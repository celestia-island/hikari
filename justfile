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
#   just dev             - Blocking foreground dev server (hot-reload)
#   just dev --daemon    - Start/restart daemon (non-blocking, for AI agents)
#   just dev --daemon stop - Stop daemon
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
build-website: (check-tairitsu-packager)
    @echo "  ╭──────────────────────────────────────────────────╮"
    @echo "  │  Building website with tairitsu-packager         │"
    @echo "  ╰──────────────────────────────────────────────────╯"
    @cd examples/website && tairitsu --manifest-path Cargo.toml build

# ============================================================================
# Development
# ============================================================================

# Development mode for website
#   just dev             - Blocking foreground with hot-reload
#   just dev --daemon    - Start/restart daemon (non-blocking)
#   just dev --daemon stop - Stop daemon
dev *FLAGS="": (check-tairitsu-packager)
    cd examples/website && tairitsu --manifest-path Cargo.toml dev --port 3000 --watch {{FLAGS}}

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
    @{{py}} scripts/run_parallel_screenshots.py
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
    @cargo build --release --package hikari-e2e --bin hikari-browser-debug \
                 --bin hikari-visual-debug

# --- Tairitsu browser-test integration ---

# Install Chromium via Tairitsu's BrowserDownloader
browser-install:
    @cd ../tairitsu && cargo run --package tairitsu-browser-test -- browser install

# Visual debug: capture screenshots of all key pages (powered by tairitsu-browser-test)
visual-capture url="http://localhost:3000" output="/tmp/e2e_screenshots" filter="":
    @cargo run --release --package hikari-e2e --bin hikari-visual-debug -- capture \
        --base-url "{{url}}" --output-dir "{{output}}" {{if filter != "" { "--filter " + filter } else { "" } }} --json

# Visual debug: batch capture all routes with full report
visual-batch url="http://localhost:3000" output="/tmp/e2e_screenshots":
    @cargo run --release --package hikari-e2e --bin hikari-visual-debug -- batch \
        --base-url "{{url}}" --output-dir "{{output}}" --json --report-path "/tmp/e2e_screenshots/report.json"

# Visual debug: inspect a single page (layout metrics + screenshot)
visual-inspect route="/" url="http://localhost:3000" output="inspect.png":
    @cargo run --release --package hikari-e2e --bin hikari-visual-debug -- inspect \
        --base-url "{{url}}" --route "{{route}}" --output "{{output}}"

# Full visual pipeline: install chrome → capture → ready for AI analysis
visual-pipeline: browser-install visual-batch
    @echo ""
    @echo "  ╔══════════════════════════════════════════╗"
    @echo "  ║  Screenshots saved to /tmp/e2e_screenshots ║"
    @echo "  ║  Report: /tmp/e2e_screenshots/report.json  ║"
    @echo "  ║  Ready for AI visual analysis              ║"
    @echo "  ╚══════════════════════════════════════════╝"

# --- Wry-based visual debug (via tairitsu-debug HTTP API) ---

build-debug-wry:
    @cargo build --release --package hikari-e2e --bin hikari-visual-debug-wry

wry-health debug_port="3001":
    @cargo run --release --package hikari-e2e --bin hikari-visual-debug-wry -- health --debug-port {{debug_port}}

wry-capture route="/" debug_port="3001" output="":
    @cargo run --release --package hikari-e2e --bin hikari-visual-debug-wry -- \
        capture --debug-port {{debug_port}} --route "{{route}}" --full-page {{if output != "" { "--output " + output } else { "" } }}

wry-batch debug_port="3001" output="" routes="":
    @cargo run --release --package hikari-e2e --bin hikari-visual-debug-wry -- \
        batch --debug-port {{debug_port}} --output-json {{if output != "" { "--output " + output } else { "" }} {{if routes != "" { "--routes " + routes } else { "" } }}

wry-inspect route="/" selector="" debug_port="3001":
    @cargo run --release --package hikari-e2e --bin hikari-visual-debug-wry -- \
        inspect --debug-port {{debug_port}} --route "{{route}}" {{if selector != "" { "--selector " + selector } else { "" } }}

wry-interactive route="/" debug_port="3001":
    @cargo run --release --package hikari-e2e --bin hikari-visual-debug-wry -- \
        interactive --debug-port {{debug_port}} --route "{{route}}"

wry-pipeline debug_port="3001": wry-health wry-batch
    @echo "  ✓  Wry screenshots saved to wry_screenshots/"
    @echo "  ✓  Ready for AI vision analysis"

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

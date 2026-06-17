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

# External packager (tairitsu CLI via cargo install tairitsu-packager)
website_manifest := "examples/website/Cargo.toml"

# ============================================================================
# Core tasks
# ============================================================================

default:
    @just --list

# ============================================================================
# Infrastructure setup
# ============================================================================

# Check that tairitsu CLI is available in PATH
check-tairitsu-packager:
    @tairitsu --help > /dev/null 2>&1 || (echo "[ERROR] tairitsu CLI not found in PATH. Install: cargo install tairitsu-packager" && exit 1)

# Fetch MDI icons (download SVGs from GitHub) and pack into .dat
fetch-icons:
    @{{py}} scripts/icons/fetch_mdi_icons.py
    @{{py}} scripts/icons/pack_mdi_data.py

# Sync markdown docs from root docs/ to website public/docs/
sync-docs:
    @{{py}} scripts/sync_docs.py

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
build-website: sync-docs (check-tairitsu-packager)
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

serve: dev

# ============================================================================
# Code quality
# ============================================================================

# Format code with rustfmt (nightly to match CI)
fmt:
    @echo "  →  Formatting code..."
    @cargo +nightly fmt --all -- --unstable-features

# Run Clippy checks
clippy:
    @echo "  →  Running Clippy..."
    @cargo clippy --all-targets --all-features -- -D warnings

# ============================================================================
# Cleaning
# ============================================================================

# Clean build artifacts
clean:
    @echo "  →  Cleaning..."
    @{{py}} scripts/clean.py

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
# Coverage (requires nightly + cargo-llvm-cov)
# ============================================================================

# Generate coverage report (HTML + lcov)
coverage:
    @echo "  →  Generating coverage report..."
    @cargo llvm-cov --workspace --lcov --output-path lcov.info
    @cargo llvm-cov --workspace --html
    @echo "  ✓  HTML report → target/llvm-cov/html/index.html"
    @echo "  ✓  lcov info   → lcov.info"

# Show coverage summary only (fast)
coverage-summary:
    @cargo llvm-cov --workspace --summary-only

# Clean coverage artifacts
coverage-clean:
    @cargo llvm-cov clean --workspace

# ============================================================================
# Utilities
# ============================================================================

# Update dependencies
update:
    @echo "  →  Updating dependencies..."
    @cargo update

# ============================================================================
# Browser Debug & E2E (Python framework, powered by Tairitsu MCP)
# ============================================================================
#
# The E2E framework is now pure Python (scripts/e2e/), replacing the old
# Rust hikari-e2e package. It communicates with tairitsu-debug HTTP API.
#
# Key commands:
#   just health              - Check if tairitsu-debug server is running
#   just capture             - Screenshot a single page
#   just batch               - Batch capture all routes
#   just inspect             - Inspect a single page (diagnostics)
#   just compare             - Compare screenshots / visual regression
#   just baseline ...        - Manage golden screenshots
#   just e2e-run             - Execute a JSON test suite
# ============================================================================

# Install Python dependencies for E2E framework
e2e-install:
    @{{py}} -m pip install Pillow requests --quiet 2>/dev/null || echo "Note: pip install may need --user or venv"

# Check tairitsu-debug server health (replaces wry-health)
health debug_port="3001":
    @{{py}} scripts/e2e/cli.py health --debug-port {{debug_port}}

# Capture a single screenshot (replaces hikari-browser-debug navigate)
capture route="/" output="" wait="8":
    @{{py}} scripts/e2e/cli.py capture --route "{{route}}" {{if output != "" { "--output " + output } else { "" } }} --wait {{wait}}

# Batch capture all routes (replaces visual-batch / wry-batch)
batch url="http://localhost:3000" output="./screenshots" routes="" wait="8":
    @{{py}} scripts/e2e/cli.py batch --url "{{url}}" --output "{{output}}" {{if routes != "" { "--routes " + routes } else { "" } }} --wait {{wait}}

# Inspect a single page: screenshot + errors + console + DOM snapshot
inspect route="/" output="inspect.png" wait="8":
    @{{py}} scripts/e2e/cli.py inspect --route "{{route}}" --output "{{output}}" --wait {{wait}}

# Compare two screenshots or run regression against baselines
compare expected="" actual="" baseline_dir="" candidate_dir="" threshold="30":
    @{{py}} scripts/e2e/cli.py compare \
        {{if expected != "" { "--expected " + expected } else { "" }}} \
        {{if actual != "" { "--actual " + actual } else { "" }}} \
        {{if baseline_dir != "" { "--baseline-dir " + baseline_dir } else { "" }}} \
        {{if candidate_dir != "" { "--candidate-dir " + candidate_dir } else { "" }}} \
        --threshold {{threshold}}

# Baseline management: init, set, accept, list, delete, export
baseline action="list" name="" image="" route="" suite="default":
    @{{py}} scripts/e2e/cli.py baseline {{action}} \
        {{if name != "" { "--name " + name } else { "" }}} \
        {{if image != "" { "--image " + image } else { "" }}} \
        {{if route != "" { "--route " + route } else { "" }}} \
        --suite {{suite}}

# Run a JSON test suite (replaces main hikari-e2e binary)
e2e-run suite="" url="http://localhost:3000" output="e2e_output" html="":
    @{{py}} scripts/e2e/cli.py run "{{suite}}" --url "{{url}}" --output "{{output}}" {{if html != "" { "--html" } else { "" }}}

# ============================================================================
# Visual Regression CI (Playwright-based, for GitHub Actions)
# ============================================================================
#
# CI-friendly visual regression using Playwright (no tairitsu-debug needed):
#   just vr-capture           - Capture baseline/candidate screenshots
#   just vr-compare           - Compare candidates vs baselines
#   just vr-baseline-init     - Promote current screenshots as baselines
#   just vr-baseline-accept   - Accept a specific candidate as new baseline
#   just vr-run               - Full pipeline: capture + compare
#
# Baselines live in tests/visual/baseline/default/
# ============================================================================

vr-install:
    @{{py}} -m pip install Pillow playwright requests --quiet 2>/dev/null
    @{{py}} -m playwright install chromium --with-deps 2>/dev/null || echo "Playwright install may need sudo"

# Capture screenshots via tairitsu debug API (requires `just dev --debug` running)
vr-capture debug_url="http://localhost:3001" site_url="http://localhost:3000" output="target/screenshots" wait="3":
    @{{py}} scripts/visual-ci/capture_debug_api.py --debug-url "{{debug_url}}" --site-url "{{site_url}}" --output "{{output}}" --wait {{wait}}

# Compare candidate screenshots against baselines (via tairitsu visual-diff)
vr-compare baseline_dir="tests/visual/baseline/default" candidate_dir="target/screenshots" output="target/visual-diff" tolerance="0.01":
    @tairitsu visual-diff \
        --actual-dir "{{candidate_dir}}" \
        --baseline-dir "{{baseline_dir}}" \
        --output-dir "{{output}}" \
        --tolerance {{tolerance}}

# Initialize baseline directory structure
vr-baseline-init:
    @{{py}} scripts/visual-ci/baseline.py init

# Promote current screenshots as baselines
vr-baseline-accept-all candidate_dir="target/screenshots":
    @{{py}} scripts/visual-ci/baseline.py accept-all --candidate-dir "{{candidate_dir}}"

# Accept a single candidate image as new baseline
vr-baseline-accept name="" candidate_dir="target/screenshots":
    @{{py}} scripts/visual-ci/baseline.py accept --name "{{name}}" --candidate-dir "{{candidate_dir}}"

# Full visual regression pipeline: capture + compare (requires `just dev --debug`)
vr-run tolerance="0.01":
    @just vr-capture
    @just vr-compare --tolerance {{tolerance}}
    @echo ""
    @echo "  \u2564\u2500 Visual Regression Results \u2500\u2567"
    @cat target/visual-diff/report.json 2>/dev/null || echo "  No results yet — run vr-capture first"

# Full visual regression: capture + compare all component pages
vr-full: (check-tairitsu-packager)
    @echo "  →  Running full component visual regression..."
    @{{py}} scripts/e2e/cli.py run tests/visual/full_component_coverage.json --url http://localhost:3000 --output target/visual-full --baseline-dir tests/visual/baseline

# Initialize baselines for all component pages (requires dev server)
vr-init-baselines:
    @{{py}} scripts/e2e/baseline_init.py --url http://localhost:3000 --debug-port 3001

# Dry-run: show missing baselines without capturing
vr-missing:
    @{{py}} scripts/e2e/baseline_init.py --dry-run

# Interactive session from commands JSON file
interactive input="scripts/dev/commands/example_commands.json" output-dir="scripts/dev/screenshots":
    @{{py}} scripts/e2e/cli.py interactive --input "{{input}}" --output-dir "{{output-dir}}"

debug-chrome-up:
    @docker compose -f docker/docker-compose.debug.yml up -d chrome-debug
    @echo "  - VNC: vnc://localhost:5900"
    @echo "  - noVNC: http://localhost:7900"

debug-chrome-down:
    @docker compose -f docker/docker-compose.debug.yml down

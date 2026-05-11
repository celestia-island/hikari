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
tairitsu_packager_manifest := env_var_or_default("TAIRITSU_PACKAGER", justfile_directory() / ".." / "tairitsu" / "packages" / "packager" / "Cargo.toml")
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
[linux]
clean:
    @echo "  →  Cleaning..."
    @cargo clean 2>/dev/null || true
    @rm -rf examples/website/dist packages/icons/src/generated public 2>/dev/null || true
    @echo "  ✓  Clean completed"

[windows]
clean:
    @pwsh.exe -NoLogo -Command "echo '  →  Cleaning...'; cargo clean; if (Test-Path examples/website/dist) { Remove-Item -Recurse -Force examples/website/dist }; if (Test-Path packages/icons/src/generated) { Remove-Item -Recurse -Force packages/icons/src/generated }; if (Test-Path public) { Remove-Item -Recurse -Force public }; echo '  ✓  Clean completed'"

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
    @echo "  →  Use 'just build-website' or 'tairitsu build' to compile SCSS"

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

# Capture screenshots for all baseline routes (Playwright, no tairitsu-debug)
vr-capture url="http://localhost:3000" output="target/screenshots" wait="10":
    @{{py}} scripts/visual-ci/capture_ci.py --url "{{url}}" --output "{{output}}" --wait {{wait}}

# Compare candidate screenshots against baselines
vr-compare baseline_dir="tests/visual/baseline/default" candidate_dir="target/screenshots" output="target/visual-diff" threshold="30":
    @{{py}} scripts/visual-ci/compare_ci.py \
        --baseline-dir "{{baseline_dir}}" \
        --candidate-dir "{{candidate_dir}}" \
        --output "{{output}}" \
        --threshold {{threshold}}

# Initialize baseline directory structure
vr-baseline-init:
    @mkdir -p tests/visual/baseline/default
    @touch tests/visual/baseline/default/.gitkeep
    @echo "  \u2713 Baseline dir ready: tests/visual/baseline/default/"

# Promote current screenshots as baselines
vr-baseline-accept-all candidate_dir="target/screenshots":
    @{{py}} -c "
import shutil, glob, time
from pathlib import Path
src = Path('{{candidate_dir}}')
dst = Path('tests/visual/baseline/default')
dst.mkdir(parents=True, exist_ok=True)
for f in sorted(src.glob('*.png')):
    if f.name != 'capture_report.json':
        shutil.copy2(f, dst / f.name)
        print(f'  \u2713 {f.name}')
print(f'Done. {len(list(dst.glob(\"*.png\")))} baselines in {dst}')
"

# Accept a single candidate image as new baseline
vr-baseline-accept name="" image="" route="":
    @{{py}} scripts/e2e/cli.py baseline accept --name "{{name}}" --image "{{image}}" --route "{{route}}"

# Full visual regression pipeline: capture + compare
vr-run url="http://localhost:3000" threshold="30":
    @just vr-capture --url "{{url}}"
    @just vr-compare --threshold {{threshold}}
    @echo ""
    @echo "  \u2564\u2500 Visual Regression Results \u2500\u2567"
    @cat target/visual-diff/result.json 2>/dev/null || echo "  No results yet — run vr-capture first"

# Interactive session from commands JSON file
interactive input="scripts/dev/commands/example_commands.json" output-dir="scripts/dev/screenshots":
    @{{py}} scripts/e2e/cli.py interactive --input "{{input}}" --output-dir "{{output-dir}}"

# --- Backward-compatible aliases (old names → new Python implementation) ---

build-debug:
    @echo "  ℹ️  build-debug is now unnecessary — the E2E framework is pure Python."
    @echo "     Run 'just e2e-install' to ensure dependencies are installed."

browser-install:
    @echo "  ℹ️  browser-install not needed — tairitsu-debug is built into the dev server."
    @echo "     Start with 'just dev --daemon' and use 'just health' to verify."

# Aliases for old recipe names
visual-capture url="http://localhost:3000" output="/tmp/e2e_screenshots" filter="":
    @just capture --route "/" --output "{{output}}/home.png"
    @just batch --url "{{url}}" --output "{{output}}" {{if filter != "" { "--routes " + filter } else { "" }}}

visual-batch url="http://localhost:3000" output="/tmp/e2e_screenshots":
    @just batch --url "{{url}}" --output "{{output}}" --report "{{output}}/report.json"

visual-inspect route="/" url="http://localhost:3000" output="inspect.png":
    @just inspect --route "{{route}}" --output "{{output}}"

visual-pipeline: health batch
    @echo ""
    @echo "  ╔══════════════════════════════════════════╗"
    @echo "  ║  Screenshots saved to ./screenshots       ║"
    @echo "  ║  Ready for AI visual analysis              ║"
    @echo "  ╚══════════════════════════════════════════╝"

build-debug-wry: build-debug

wry-health debug_port="3001":
    @just health {{debug_port}}

wry-capture route="/" debug_port="3001" output="":
    @{{py}} scripts/e2e/cli.py capture --route "{{route}}" {{if output != "" { "--output " + output } else { "" } }} --debug-port {{debug_port}}

wry-batch debug_port="3001" output="" routes="":
    @{{py}} scripts/e2e/cli.py batch --debug-port {{debug_port}} --output "{{if output != "" { output } else { "./screenshots" } }}" {{if routes != "" { "--routes " + routes } else { "" }}}

wry-inspect route="/" selector="" debug_port="3001":
    @{{py}} scripts/e2e/cli.py inspect --route "{{route}}" --debug-port {{debug_port}}

wry-interactive route="/" debug_port="3001":
    @{{py}} scripts/e2e/cli.py interactive --debug-port {{debug_port}}

wry-pipeline debug_port="3001": wry-health wry-batch
    @echo "  ✓  Screenshots saved to ./screenshots/"
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

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

set shell := ["bash", "-c"]
# Windows: PowerShell (the 5.1 floor ships with every Windows; pwsh 7 is
# NOT assumed). Linewise recipes must stay PS-5.1-safe: no `&&` chains,
# `cd X; cmd` instead of `cd X && cmd`. Bash-only recipes use
# [script('bash')] and need Git Bash (or WSL) when actually run.
set windows-shell := ["powershell.exe", "-NoLogo", "-NoProfile", "-Command", "[Console]::OutputEncoding=[System.Text.Encoding]::UTF8; $PSDefaultParameterValues['*:Encoding']='utf8';"]
set unstable
set lists

# Repo definitions override the shared template's (imported above).
set allow-duplicate-recipes
set allow-duplicate-variables

# Shared celestia-devtools recipes — NOT in git. `import?` silently skips when
# absent, so this justfile parses pre-fetch. Bootstrap once: celestia-devtools
# init (or `just fetch` if already staged). Refresh after upgrades.
import? "./.just/git-bash-interop.just"
import? "./.just/celestia-devtools.just"

# Stage shared celestia-devtools recipes into .just/ (gitignored).
# Source order: explicit URL arg → local pip bundle (offline) → GitHub raw.
# curl honors HTTP_PROXY/HTTPS_PROXY/ALL_PROXY env vars automatically.
fetch URL='':
    {{ if os_family() == "windows" { "python" } else { "python3" } }} -c "import os; os.makedirs('.just', exist_ok=True)"
    {{ if URL != "" { "curl -fsSL " + URL + " -o .just/celestia-devtools.just" } else if which("celestia-devtools") != "" { "celestia-devtools fetch-just" } else { "curl -fsSL https://raw.githubusercontent.com/celestia-island/celestia-devtools/dev/src/celestia_devtools/common.just -o .just/celestia-devtools.just" } }}
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

# ------
# Core tasks
# ------


default:
    @just --list

# ------
# Infrastructure setup
# ------

# Check that tairitsu-packager is available from sibling repository
check-tairitsu-packager:
    @{{py}} -c "import pathlib,sys; p=pathlib.Path('{{tairitsu_packager_manifest}}'); sys.exit(0) if p.exists() else (print(f'[ERROR] Missing tairitsu-packager: {p}'), sys.exit(1))"

# Fetch MDI icons (optional - tairitsu will also handle this)
fetch-icons:
    @echo "  →  Fetching MDI icons..."
    @{{py}} scripts/icons/fetch_mdi_icons.py

# ------
# Build tasks
# ------

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

# ------
# Development
# ------

# Verify the lagrange binary exists, with a helpful error if not.
_check-lagrange:
    @{{py}} -c "import sys, pathlib; p = pathlib.Path(r'{{lagrange_bin}}'); sys.exit(0) if p.exists() else (print('[ERROR] lagrange not built: %s' % p), print('  Run: cd {{lagrange_root}} && cargo build --release'), sys.exit(1))"

# Development mode: build docs with lagrange + serve with file-watch auto-restart
# via malkuth. Watches docs/ for changes.
[script('python')]
dev:
    import os, shutil, subprocess, sys
    from datetime import datetime

    def log(msg):
        print(f"{datetime.now():%Y-%m-%d %H:%M:%S}  INFO hikari-dev: {msg}")

    def err(msg):
        print(f"{datetime.now():%Y-%m-%d %H:%M:%S} ERROR hikari-dev: {msg}", file=sys.stderr)

    lagrange_bin = r"{{lagrange_bin}}"
    lagrange_root = r"{{lagrange_root}}"
    if not os.path.isfile(lagrange_bin):
        err(f"lagrange not built: {lagrange_bin}")
        err(f"run: cd {lagrange_root} && cargo build --release")
        sys.exit(1)
    malkuth = os.environ.get("MALKUTH_BIN") or shutil.which("malkuth") or "../malkuth/target/release/malkuth"
    if shutil.which(malkuth) is None and not os.path.isfile(malkuth):
        malkuth = "../malkuth/target/release/malkuth.exe"
    if shutil.which(malkuth) is None and not os.path.isfile(malkuth):
        err("malkuth not found. Build it: cd ../malkuth && cargo build --release --features cli")
        sys.exit(1)
    log(f"supervising: {lagrange_bin} dev --src docs --out dist --port 3000")
    log("watching: docs")
    os.execvp(malkuth, [malkuth, "--watch", "docs", "--drain-secs", "2", "--",
                        lagrange_bin, "dev", "--src", "docs", "--out", "dist", "--port", "3000"])

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

# ------
# Code quality
# ------

# Format code with rustfmt
fmt:
    just fmt-toml
    @echo "  →  Formatting code..."
    @cargo fmt --all

# Run Clippy checks
clippy:
    @echo "  →  Running Clippy..."
    @cargo clippy --all-targets --all-features -- -D warnings

# ------
# Cleaning
# ------

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

# ------
# E2E Testing
# ------

# Run E2E screenshots in parallel
e2e-parallel:
    @echo "  →  Running E2E tests..."
    @{{py}} scripts/run_parallel_screenshots.py
    @echo "  ✓  Screenshots saved to: target/e2e_screenshots/"

# Test specific route
e2e-test route="":
    @docker run --rm --network host -v "{{justfile_directory()}}/target/e2e_screenshots:/tmp/e2e_screenshots" -v "{{justfile_directory()}}/public:/public:ro" hikari/screenshot:selenium /usr/local/bin/hikari-screenshot --start "{{route}}" --end "{{route}}"

# ------
# Unit Testing
# ------

# Run all tests
test:
    @echo "  →  Running tests..."
    @cargo test --workspace

# Run tests with output
test-verbose:
    @cargo test --workspace -- --nocapture

# ------
# Utilities
# ------

# Update dependencies
update:
    @echo "  →  Updating dependencies..."
    @cargo update

# Generate SCSS bundle manually
generate-scss:
    @cargo build --manifest-path packages/builder/Cargo.toml

# ------
# Browser Debug (for AI agents)
# ------

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

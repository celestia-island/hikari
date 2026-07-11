# celestia-devtools common.just — vendored build recipes.
#
# This file is COPIED into your repo by `celestia-devtools init`.
# Commit it to git so every clone gets it — no package install needed
# to parse the justfile, only to run the recipes.
#
# Refresh with:  celestia-devtools init --force
# Version: 0.3.0
#
# All recipes and variables are overridable — redefine anything after the
# `import` line in your justfile to customize it.
#
# This file is intentionally free of `set` directives (shell, windows-shell,
# unstable) so it composes cleanly with each repo's own header.
#
# Windows note: `set windows-shell` only governs linewise recipes. Shebang
# recipes bypass it and force `just` to call `cygpath` (which Git for Windows
# keeps off PATH), so they die with "could not find cygpath executable". To
# avoid that, the multi-line recipes below use the `[script('bash')]` attribute
# (stable since just 1.32.0), which resolves the interpreter via PATH and never
# calls cygpath. The `windows-shell-check` recipe below verifies bash is on PATH.

# ── Tool resolution ───────────────────────────────────────────────────────────

# On Windows prefer `python` — `python3` is often the broken WindowsApps Store
# stub that exits 49. On Unix, `python3` is the norm.
python_cmd := if os_family() == "windows" {
    if which("python") != "" { "python" } else { "python3" }
} else {
    if which("python3") != "" { "python3" } else { "python" }
}

# Resolve the celestia-devtools CLI: installed entry point, or module fallback.
_devtools := if which("celestia-devtools") != "" { "celestia-devtools" } else { python_cmd + " -m celestia_devtools" }

# ── Bootstrap ─────────────────────────────────────────────────────────────────

# Ensure celestia-devtools is installed. Run once on a fresh checkout.
# Override the install source with $CELESTIA_DEVTOOLS_INSTALL (e.g. a local path).
ensure:
    @command -v celestia-devtools >/dev/null 2>&1 || \
        {{python_cmd}} -c "import celestia_devtools" 2>/dev/null || \
        pip3 install "${CELESTIA_DEVTOOLS_INSTALL:-git+https://github.com/celestia-island/celestia-devtools.git}"

# Fail fast on Windows if the importing justfile forgot `set windows-shell`.
# On Windows, `just` resolves recipe shebangs through `cygpath` when no
# windows-shell is set, and Git for Windows does not put `cygpath` on PATH — so
# every shebang recipe then dies with a cryptic "could not find cygpath
# executable" error. This recipe surfaces the real cause up front. No-op on
# non-Windows hosts.
[script('bash')]
windows-shell-check:
    set -euo pipefail
    if [ "{{os_family()}}" != "windows" ]; then
      echo "windows-shell-check: non-Windows host, nothing to check."
      exit 0
    fi
    if ! command -v bash.exe >/dev/null 2>&1; then
      echo "windows-shell-check: bash.exe not on PATH." >&2
      echo "  Install Git for Windows, or add its usr/bin to PATH." >&2
      exit 1
    fi
    echo "windows-shell-check: bash.exe found. Ensure the importing justfile sets:"
    echo "  set windows-shell := [\"bash.exe\", \"-c\"]"

# ── Build helper ──────────────────────────────────────────────────────────────

# Shared build dispatcher: runs a prerequisite, then picks dev vs release cmd.
#
#   just _build ":" "cargo build" "cargo build --release" {{FLAGS}}
#   just _build "just cache-guard" "cargo build" "cargo build --release" --dev
#
# Flags (consumed from *FLAGS):
#   --dev    use the dev command instead of release
#   --clean  cargo clean before building
[script('bash')]
_build always_pre dcmd rcmd *FLAGS='':
    set -euo pipefail
    profile=release
    for a in {{FLAGS}}; do
      case "$a" in
        --dev)   profile=dev ;;
        --clean) cargo clean ;;
      esac
    done
    [ "X{{always_pre}}" != "X:" ] && {{always_pre}}
    if [ "$profile" = dev ]; then {{dcmd}}; else {{rcmd}}; fi

# ── Cache management ──────────────────────────────────────────────────────────

# target/ cache guard:
#   free-disk floor < 10 GiB → cargo clean (instant check, every run)
#   target ≥ 40 GiB → cargo sweep --time 7 (needs cargo-sweep; cached du)
# Tune via flags or CARGO_CACHE_GUARD_* env vars. Run before `just build`.
cache-guard *ARGS='':
    {{ _devtools }} cache-guard . {{ARGS}}

# Backwards-compatible alias of cache-guard.
sweep-guard min_free="10":
    {{ _devtools }} cache-guard . --min-free-gib {{min_free}}

# Manually remove target/**/incremental/ (keeps compiled dep artifacts).
clean-incremental:
    {{ _devtools }} cache-guard . --clean-incremental

# ── Formatting ────────────────────────────────────────────────────────────────

# Format Markdown docs (stdlib-only; call inside your fmt/fmt-check recipe).
# Does NOT touch Rust or JS — compose with cargo fmt / pnpm lint yourself.
fmt-markdown *ARGS='':
    {{ _devtools }} format-markdown . {{ARGS}}

# ── Commit message lint ──────────────────────────────────────────────────────

# Validate a commit message against the org gitmoji convention.
# Pass the commit-msg file path (git passes $1 to the hook).
commit-msg-lint FILE:
    {{ _devtools }} commit-msg-lint check {{ FILE }}

# Install (or refresh) the org commit-msg hook into .git/hooks/.
# Normally triggered automatically by `celestia-devtools init`; call this
# directly to reinstall after a force-override or to install into a fresh
# checkout where init has already vendored the justfile.
commit-msg-hook-install *ARGS='':
    {{ _devtools }} hook install {{ ARGS }}

# ── Dependencies ──────────────────────────────────────────────────────────────

# Pre-stage all deps for offline builds (cargo fetch + pnpm/npm/yarn install).
# Run once after cloning (needs network); subsequent builds run fully offline.
prefetch:
    {{ _devtools }} prefetch .

# ── Cross-compilation ─────────────────────────────────────────────────────────

# Check and auto-install cross-compilation prerequisites (rustup target +
# ziglang + cargo-zigbuild). Mirror selection auto-detected (TUNA for CN).
cross-check target='aarch64-unknown-linux-gnu' features='full':
    {{ _devtools }} check-cross-deps --target {{target}} --features {{features}}

# ── Crate location ────────────────────────────────────────────────────────────

# Locate a celestia-island crate checkout (env → cargo [patch] → sibling → clone).
locate crate:
    {{ _devtools }} locate --crate {{crate}}

# ── File-watch dev server (malkuth) ──────────────────────────────────────────
#
# Wraps any command with malkuth's file-watching + auto-restart supervisor.
# malkuth (celestia-island/malkuth) uses notify v8 for recursive directory
# watching with 400 ms debounce, and kill+respawn on each change.
#
#   just dev-watch src -- cargo run
#   just dev-watch src docs -- lagrange dev --src docs --port 3000
#   just dev-watch packages -- cargo run --features full
#
# The first N positional args (before `--`) are watch paths. Everything after
# `--` is the command to supervise.
#
# Override the malkuth binary location with $MALKUTH_BIN or $MALKUTH_ROOT.

# Resolve the malkuth binary path (env → PATH → sibling layout).
malkuth_bin := if env("MALKUTH_BIN", "") != "" {
    env("MALKUTH_BIN", "")
} else if env("MALKUTH_ROOT", "") != "" {
    env("MALKUTH_ROOT", "") + if os_family() == "windows" { "/target/release/malkuth.exe" } else { "/target/release/malkuth" }
} else if which("malkuth") != "" {
    "malkuth"
} else {
    "../malkuth/target/release/" + if os_family() == "windows" { "malkuth.exe" } else { "malkuth" }
}

[script('bash')]
dev-watch *ARGS:
    set -euo pipefail
    # Split args at `--`: everything before = watch paths, after = command.
    watch_paths=()
    cmd=()
    found_sep=0
    for arg in {{ARGS}}; do
      if [ "$arg" = "--" ]; then
        found_sep=1
        continue
      fi
      if [ "$found_sep" = "1" ]; then
        cmd+=("$arg")
      else
        watch_paths+=("$arg")
      fi
    done
    if [ "${#cmd[@]}" -eq 0 ]; then
      echo "usage: just dev-watch <watch-paths...> -- <command...>" >&2
      echo "  e.g.  just dev-watch src -- cargo run" >&2
      exit 1
    fi
    # Resolve malkuth binary — try the static path, then locate.
    malkuth="{{malkuth_bin}}"
    if ! command -v "$malkuth" >/dev/null 2>&1 && [ ! -f "$malkuth" ]; then
      malkuth_path=$( {{python_cmd}} -m celestia_devtools locate --crate malkuth 2>/dev/null || true )
      if [ -n "$malkuth_path" ]; then
        suffix="target/release/malkuth"
        case "$(uname -s)" in MINGW*|MSYS*|CYGWIN*) suffix="target/release/malkuth.exe" ;; esac
        malkuth="$malkuth_path/$suffix"
      fi
    fi
    if ! command -v "$malkuth" >/dev/null 2>&1 && [ ! -f "$malkuth" ]; then
      echo "[dev-watch] malkuth not found." >&2
      echo "[dev-watch] Build it: cd ../malkuth && cargo build --release --features cli" >&2
      echo "[dev-watch] Or set: export MALKUTH_BIN=/path/to/malkuth" >&2
      exit 1
    fi
    # Build --watch flags.
    watch_flags=()
    for p in "${watch_paths[@]}"; do
      watch_flags+=(--watch "$p")
    done
    echo "[dev-watch] supervising: ${cmd[*]}"
    echo "[dev-watch] watching: ${watch_paths[*]}"
    exec "$malkuth" "${watch_flags[@]}" --drain-secs 2 -- "${cmd[@]}"

# Auto-register all local celestia-island repos as cargo [patch] entries in
# ~/.cargo/config.toml. Scans the sibling directory for git repos whose origin
# points at celestia-island, discovers their workspace member crates, and writes
# [patch] sections so cargo resolves every celestia crate to its local checkout.
#
#   just register-patches              scan + write
#   just register-patches --dry-run    preview only
#   just register-patches --repo hikari,lagrange   limit to specific repos
register-patches *ARGS='':
    {{ _devtools }} register-patches {{ARGS}}

# ── WSL2 dev environment ──────────────────────────────────────────────────────
#
# The celestia ecosystem shares ONE persistent WSL2 distro (default
# "celestia-dev") provisioned with rust + just + docker, so the global cargo
# registry cache is reused across aris / kei / entelecheia / shittim-chest
# instead of re-fetching every dependency per repo. Same model as Docker
# Desktop's managed WSL2 backend.
#
#   just wsl-ensure              create/verify (idempotent — safe to re-run)
#   just wsl-ensure --reset      destroy + recreate (clears ALL caches)
#   just wsl-ensure --no-docker  skip docker (use Docker Desktop integration)
#   just wsl-ensure --force      re-provision even if distro already exists
wsl-ensure *ARGS='':
    {{ _devtools }} wsl-ensure {{ARGS}}

# Run a command inside the celestia-dev distro (cwd = this repo's root).
# Example: just wsl-run cargo build --release
wsl-run *CMD='echo "usage: just wsl-run <command>"':
    wsl -d celestia-dev --cd "{{ justfile_directory() }}" -- bash -lc "{{ CMD }}"

# Drop into an interactive shell in the distro at the repo root.
wsl-shell:
    wsl -d celestia-dev --cd "{{ justfile_directory() }}"

# ── Environment preflight ────────────────────────────────────────────────────
#
# Verify required dev tools are present BEFORE a facility (pglite, build,
# cross-compile, …) actually needs them, so the user gets one actionable
# hint ("missing node → run just wsl-ensure") instead of a stack trace.
#
#   just preflight                 check ALL known tools
#   just preflight node npm        check only node + npm
#   just preflight -- --quiet      exit code only (for scripts)
preflight *REQS='':
    {{ _devtools }} preflight {{REQS}}

# ── Shared temporary PGlite ──────────────────────────────────────────────────
#
# Spawn a real embedded Postgres (PGlite WASM + pgvector) over the PG wire
# protocol, shared between entelecheia and shittim-chest for tests / mock
# backends. Zero Docker / system-postgres; data is in-memory unless --persist.
#
#   just pglite start              spawn, print DATABASE_URL (auto free port)
#   just pglite start --port 5433  pin a port
#   just pglite start --persist ./pgdata   keep data across restarts
#   just pglite stop               stop the recorded instance
#   just pglite status             is one running? prints JSON
pglite *ARGS='':
    {{ _devtools }} pglite {{ARGS}}

# ── npx precompiled distribution ─────────────────────────────────────────────
#
# Turn a cross-compiled Rust binary into a publishable npm package so users run
# it via `npx @celestia-island/<pkg>` with no Rust toolchain required. The
# generator writes a two-layer layout under ./dist: a root launcher
# (@scope/pkg) with optionalDependencies on per-platform subpackages, plus one
# subpackage per target carrying only that binary.
#
# Local dry-run (verify the staged packages without publishing):
#
#   just npm-dist shirabe                                        # reassemble root from existing dist/
#   just npm-dist shirabe 0.1.0 path/to/shirabe x86_64-unknown-linux-gnu
#
# Per-platform subpackages are staged from CI (one matrix job per target),
# then a final job reassembles the root. Actual `npm publish` runs in CI; this
# recipe only stages + `npm pack --dry-run` so you can inspect the tarball.
[script('bash')]
npm-dist name version='' binary='' target='':
    set -euo pipefail
    # Assemble the npm-dist CLI args. just params are not bash vars, so we test
    # the substituted strings directly rather than relying on ${var:+}.
    base=(--name "{{name}}" --out-dir dist)
    [ -n "{{version}}" ] && base+=(--version "{{version}}")
    if [ -n "{{binary}}" ]; then
      if [ -z "{{target}}" ]; then
        echo "npm-dist: --target required when --binary given" >&2
        exit 1
      fi
      base+=(--binary "{{binary}}" --rust-target "{{target}}")
    fi
    {{ _devtools }} npm-dist "${base[@]}"
    cd dist && npm pack --dry-run

# Publish the staged packages to npm (requires NPM_TOKEN in the environment).
# Intended for CI; prompts interactively for the OTP if 2FA is on.
# Override the tag with NPM_DIST_TAG (default: latest).
[script('bash')]
npm-release *PKGS='':
    set -euo pipefail
    cd dist
    tag="${NPM_DIST_TAG:-latest}"
    if [ $# -eq 0 ]; then
      npm publish --access public --tag "$tag"
    else
      for pkg in "$@"; do
        npm publish "$pkg" --access public --tag "$tag"
      done
    fi

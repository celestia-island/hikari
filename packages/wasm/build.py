#!/usr/bin/env python3
"""Build the hikari wasm components and generate their JS bindings.

For each component under ``packages/wasm/``:

1. ``cargo build --target wasm32-wasip2 --release -p hikari-wasm-<c>``
2. ``jco transpile`` → JS + ``.d.ts`` bindings
3. replace ``packages/vue/src/wasm/<c>/`` with the result (the Vue layer
   imports those files directly)

The output directory is **gitignored and not checked in**: this script is the
only way it comes to exist, so a fresh clone must run it once before
``pnpm test`` / ``pnpm lint`` in ``packages/vue`` (the suite imports the
bindings for real; without them vitest and ``vue-tsc`` fail on a missing
module). ``packages/vue/package.json`` wires that into ``pretest`` /
``prebuild`` / ``prelint``.

Usage: python3 packages/wasm/build.py [component ...]

Environment:

* ``CARGO_TARGET_DIR`` is honoured (the workspace convention for task-local
  target directories; the artifact is read back from it, so a task lane that
  builds elsewhere still works). ``ensure_artifact_fresh`` below removes the
  previous artifact first, so a stale one can never be mistaken for this
  build's output.
"""
import os
import pathlib
import shutil
import subprocess
import sys

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent.parent
VUE_DST = ROOT / "packages" / "vue" / "src" / "wasm"

#: ``--base64-cutoff``: inline the core wasm into the JS instead of emitting a
#: sibling ``.core.wasm``. The Vue package ships these files verbatim and its
#: test environments resolve them as modules, not as fetchable assets —
#: without inlining, every consumer would need a ``.core.wasm`` fetch that
#: vitest/jsdom cannot satisfy (measured: the whole component suite failed with
#: ``The URL must be of scheme file``). 1 GiB inlines every core module this
#: suite emits (the largest is well under 10 MB). Do NOT "simplify" this to
#: ``1 << 40``: jco accepts the value and silently falls back to external
#: ``.core.wasm`` fetches for it. The boundary is unsigned 2^32 — measured:
#: 4294967295 inlines, 4294967296 emits three core files, both with rc=0 and no
#: warning. That silent fallback is exactly how the first regeneration broke
#: every component test.
BASE64_CUTOFF = "1073741824"


def crate_package(comp: str) -> str:
    return f"hikari-wasm-{comp}"


def target_dir() -> pathlib.Path:
    """The cargo target directory this build writes into.

    ``CARGO_TARGET_DIR`` is part of the workspace's normal workflow (a task
    picks ``/mnt/work/target-<task>`` so the shared checkout stays clean), and
    reading the artifact from a hardcoded ``ROOT/target`` silently missed it:
    the build succeeded, then this script reported ``no wasm for qr at
    <checkout>/target/...`` while the file sat in the task directory.
    """
    configured = os.environ.get("CARGO_TARGET_DIR")
    return pathlib.Path(configured) if configured else ROOT / "target"


def ensure_artifact_fresh(wasm: pathlib.Path) -> None:
    """A stale artifact must be impossible, not merely unlikely.

    cargo is incremental: a *previous* build of the same crate in this target
    directory leaves ``hikari_wasm_<c>.wasm`` on disk before this run starts,
    so "the file exists" proves nothing about the sources we are compiling.
    Measured: a target directory whose rlibs carried older sources finished
    ``cargo build`` in 0.14 s and the timestamp on the artifact stayed 22
    minutes behind the run — a regeneration that "succeeded" without
    rebuilding. Deleting the artifact immediately before the build makes the
    build the only thing that can produce it.
    """
    wasm.unlink(missing_ok=True)


def build(comp: str) -> pathlib.Path:
    """Compile one component and return its ``.wasm``."""
    crate_dir = HERE / comp
    if not (crate_dir / "Cargo.toml").exists():
        raise SystemExit(f"error: no Cargo.toml for component {comp!r} at {crate_dir}")
    wasm = target_dir() / "wasm32-wasip2" / "release" / f"hikari_wasm_{comp.replace('-', '_')}.wasm"
    ensure_artifact_fresh(wasm)
    print(f"── building {comp}...", flush=True)
    subprocess.run(
        ["cargo", "build", "--target", "wasm32-wasip2", "--release", "-p", crate_package(comp)],
        cwd=ROOT, check=True,
    )
    if not wasm.exists():
        raise SystemExit(
            f"error: cargo reported success but {wasm} does not exist — "
            f"CARGO_TARGET_DIR is {target_dir()}; check it points at the "
            f"directory cargo actually writes"
        )
    return wasm


def main() -> int:
    comps = sys.argv[1:] or [d.name for d in HERE.iterdir() if (d / "Cargo.toml").exists()]
    for comp in sorted(comps):
        wasm = build(comp)
        out = VUE_DST / comp
        if out.exists():
            shutil.rmtree(out)
        out.mkdir(parents=True)
        subprocess.run(
            ["jco", "transpile", str(wasm), "-o", str(out),
             "--base64-cutoff", BASE64_CUTOFF],
            check=True,
        )
        size = sum(f.stat().st_size for f in out.rglob("*") if f.is_file())
        print(f"── {comp} → {out} ({size // 1024}KB)", flush=True)
    print("done")
    return 0


if __name__ == "__main__":
    sys.exit(main())

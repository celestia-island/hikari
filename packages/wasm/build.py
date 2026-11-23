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
    # cargo is spawned with ``cwd=ROOT``, so a RELATIVE ``CARGO_TARGET_DIR`` is
    # resolved by cargo against the repository — **not** against whatever
    # directory this script was invoked from. Joining it to ROOT here is what
    # keeps the existence check below looking where cargo actually wrote;
    # leaving it unresolved made a build run from another directory report its
    # own success as a failure (reported in review round 2).
    return (ROOT / configured) if configured else ROOT / "target"


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


def artifact_path(comp: str) -> pathlib.Path:
    """Where cargo leaves this component's ``.wasm``."""
    return target_dir() / "wasm32-wasip2" / "release" / f"hikari_wasm_{comp.replace('-', '_')}.wasm"


def signature(path: pathlib.Path) -> tuple[int, int] | None:
    """``(st_mtime_ns, st_size)`` of an artifact, or ``None`` when it is absent.

    A function rather than an inline stat so ``build.py`` can be driven in a
    test without a compiler; see ``packages/wasm/build_test.py``.
    """
    if not path.is_file():
        return None
    stat = path.stat()
    return (stat.st_mtime_ns, stat.st_size)


def build(comp: str) -> pathlib.Path:
    """Compile one component and return its ``.wasm``.

    The returned file is the one cargo wrote **during this call**. That is what
    ``ensure_artifact_fresh`` buys: the previous file is deleted first, so its
    reappearance can only come from the build, and the mtime check below refuses
    a run where cargo finished without writing it at all. Without those two,
    "the file exists after a successful build" is true of any stale artifact
    left in the target directory (measured in review round 3: a foreign but
    valid ``.wasm`` planted under the expected name was transpiled verbatim
    into the shipped bindings while the build reported success).
    """
    crate_dir = HERE / comp
    if not (crate_dir / "Cargo.toml").exists():
        raise SystemExit(f"error: no Cargo.toml for component {comp!r} at {crate_dir}")
    wasm = artifact_path(comp)
    ensure_artifact_fresh(wasm)
    print(f"── building {comp}...", flush=True)
    try:
        subprocess.run(
            ["cargo", "build", "--target", "wasm32-wasip2", "--release", "-p", crate_package(comp)],
            cwd=ROOT, check=True,
        )
    except FileNotFoundError:
        raise SystemExit(
            "error: cargo is not on PATH — install Rust (rustup), then run "
            "`rustup target add wasm32-wasip2`"
        ) from None
    except subprocess.CalledProcessError as failure:
        raise SystemExit(
            f"error: cargo build failed for {comp} (exit {failure.returncode}) — "
            f"see the compiler output above"
        ) from None
    if signature(wasm) is None:
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
        try:
            subprocess.run(
                ["jco", "transpile", str(wasm), "-o", str(out),
                 "--base64-cutoff", BASE64_CUTOFF],
                check=True,
            )
        except FileNotFoundError:
            raise SystemExit(
                f"error: jco is not on PATH, so {comp} could not be transpiled. "
                f"Install it: npm install -g @bytecodealliance/jco"
            ) from None
        except subprocess.CalledProcessError as failure:
            # The output directory was emptied before the run, so a failure
            # here (bad WIT, jco crash, disk full) leaves nothing usable behind.
            # Say that instead of dying with a traceback: "the tree looks built
            # but the component is gone" is the shape that wastes an afternoon,
            # and the message has to name the command that redoes it.
            raise SystemExit(
                f"error: jco transpile failed for {comp} (exit {failure.returncode}).\n"
                f"       {out} was cleared for the regeneration and holds no bindings now;\n"
                f"       fix the cause, then re-run: python3 packages/wasm/build.py {comp}"
            ) from None
        size = sum(f.stat().st_size for f in out.rglob("*") if f.is_file())
        print(f"── {comp} → {out} ({size // 1024}KB)", flush=True)
    print("done")
    return 0


if __name__ == "__main__":
    sys.exit(main())

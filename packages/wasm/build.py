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
* ``CARGO_HOME`` / ``RUSTUP_HOME`` decide the two ``--remap-path-prefix`` flags
  ``component_reproducibility`` derives for **this script's own**
  ``cargo build``, so the artifact does not depend on what the caller's shell
  exported. **An unset home is fine**: cargo and rustup fall back to
  ``~/.cargo`` / ``~/.rustup``, and the derived flag names that fallback --
  which is exactly what a stock CI runner provides. What ``main`` refuses is an
  environment that cannot produce pinned bytes: a global ``RUSTFLAGS`` (cargo
  discards the per-target variable when it is set), or a home that cannot be a
  remap operand (a quote/space, ``/``, a relative path). Without the remap
  rustc bakes this machine's absolute paths into the artifact, the bytes stop
  matching the ``sha256`` this repository's descriptors pin, and akivili rejects
  the plugin at scan, feed and pack. *Why* the flag is derived from an
  environment variable rather than written into ``.cargo/config.toml`` is
  documented in that module.
"""
import json
import os
import pathlib
import shutil
import subprocess
import sys

import component_reproducibility

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
    """A best-effort guess at the cargo target directory, for callers that have no cargo.

    **``build`` does not use this** — it asks ``cargo_target_dir()``, because a
    guess and cargo's answer can disagree (a ``config.toml`` ``target-dir``, a
    relative value resolved against a different directory) and every such
    disagreement aims the build's own staleness guard at a file cargo never
    wrote. This exists as ``artifact_path``'s default so the path rule is
    stated in one place for tests and readers.

    ``CARGO_TARGET_DIR`` is part of the workspace's normal workflow (a task
    picks ``/mnt/work/target-<task>`` so the shared checkout stays clean).
    cargo is spawned with ``cwd=ROOT`` here, so a relative value is joined to
    ROOT rather than to whatever directory this script was invoked from.
    """
    configured = os.environ.get("CARGO_TARGET_DIR")
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


def artifact_path(comp: str, target: pathlib.Path | None = None) -> pathlib.Path:
    """Where cargo leaves this component's ``.wasm`` under ``target``.

    ``target`` defaults to ``target_dir()``. ``build`` asks cargo where it is
    actually writing (``cargo metadata``) instead of trusting the prediction —
    a guess that disagrees with cargo is exactly how a stale artifact gets
    read: the defence would unlink and check the wrong file (review round 4).
    """
    return (target or target_dir()) / "wasm32-wasip2" / "release" / f"hikari_wasm_{comp.replace('-', '_')}.wasm"


def cargo_target_dir() -> pathlib.Path:
    """The target directory **cargo** uses for this workspace, asked of cargo.

    ``cargo metadata`` reports ``target_directory`` after applying
    ``CARGO_TARGET_DIR`` (relative values against the process cwd), any
    ``config.toml`` override, and the workspace default. Deriving it here in
    Python instead would be a second implementation of that rule — and every
    divergence between the two is a build that transpiles bytes from somewhere
    other than the compilation it just ran.
    """
    try:
        completed = subprocess.run(
            ["cargo", "metadata", "--no-deps", "--format-version", "1", "--manifest-path", str(ROOT / "Cargo.toml")],
            cwd=ROOT, check=True, capture_output=True, text=True,
        )
    except FileNotFoundError:
        raise SystemExit(
            "error: cargo is not on PATH — install Rust (rustup), then run "
            "`rustup target add wasm32-wasip2`"
        ) from None
    except subprocess.CalledProcessError as failure:
        raise SystemExit(
            f"error: `cargo metadata` failed (exit {failure.returncode}) — "
            f"see the output above"
        ) from None
    return pathlib.Path(json.loads(completed.stdout)["target_directory"])


def signature(path: pathlib.Path) -> tuple[int, int] | None:
    """``(st_mtime_ns, st_size)`` of an artifact, or ``None`` when it is absent.

    ``build`` uses it for presence only; the tuple keeps a change observable to
    a caller that has the previous value. A function rather than an inline stat
    so the lane can be driven in a test without a compiler; see
    ``packages/wasm/build_test.py``.
    """
    if not path.is_file():
        return None
    stat = path.stat()
    return (stat.st_mtime_ns, stat.st_size)


def build(comp: str) -> pathlib.Path:
    """Compile one component and return its ``.wasm``.

    The returned file is the one cargo wrote **during this call**, and there
    are exactly two reasons that is true:

    * the location is ``cargo_target_dir()``'s answer, not a prediction — a
      guess that disagrees with cargo makes the guard below aim at a file
      cargo never wrote (review round 4);
    * ``ensure_artifact_fresh`` deletes the previous file first, so its
      reappearance can only come from this build, and the presence check after
      the spawn rejects a run that left nothing behind.

    What this does **not** have is a byte or mtime comparison against the
    earlier build: cargo may finish without rewriting an artifact (a build
    script re-run is not something this script can observe), so such a check
    would both miss that case and reject legitimate rebuilds. The unlink is the
    defence; ``build_test.py`` pins it.

    Without all of that, "the file exists after a successful build" is true of
    any stale artifact left in the target directory — measured in review round
    3: a foreign but valid ``.wasm`` planted under the expected name was
    transpiled verbatim into the shipped bindings while the build reported
    success.
    """
    crate_dir = HERE / comp
    if not (crate_dir / "Cargo.toml").exists():
        raise SystemExit(f"error: no Cargo.toml for component {comp!r} at {crate_dir}")
    wasm = artifact_path(comp, cargo_target_dir())
    ensure_artifact_fresh(wasm)
    print(f"── building {comp}...", flush=True)
    # A global RUSTFLAGS makes cargo DISCARD the per-target variable, so the
    # injected value below would be inert and the artifact would carry host
    # paths while this script reported success. Checked here (not only in
    # `main`) because `build` is called directly by tests and by any future
    # caller -- and it is a check about the subprocess env, which is what
    # `build` builds.
    blocking = [
        problem
        for problem in component_reproducibility.problems(require_flags=False)
        if problem.variable == component_reproducibility.GLOBAL_RUSTFLAGS_VAR
    ]
    if blocking:
        raise SystemExit(f"error: {blocking[0].detail}")
    environment = {
        **os.environ,
        component_reproducibility.RUSTFLAGS_VAR: component_reproducibility.rustflags(),
    }
    try:
        subprocess.run(
            ["cargo", "build", "--target", "wasm32-wasip2", "--release", "-p", crate_package(comp)],
            cwd=ROOT, check=True, env=environment,
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
            f"`cargo metadata` reports target_directory "
            f"{wasm.parent.parent.parent}; check the workspace config"
        )
    return wasm


def main() -> int:
    comps = sys.argv[1:] or [d.name for d in HERE.iterdir() if (d / "Cargo.toml").exists()]
    # Refuse before compiling anything: an unnormalized environment does not
    # fail this script (cargo succeeds, jco succeeds, the Vue tests pass) -- it
    # fails LATER, as a registry rejection of a digest nobody thinks they
    # changed. Checking here is the only point where the fix is still one line.
    # Homes only -- `build` rewrites the flags from them below, so judging the
    # caller's `CARGO_TARGET_WASM32_WASIP2_RUSTFLAGS` here would refuse a shell
    # whose stale value this script cannot be harmed by, and would demand an
    # export that the very next line overrides.
    if component_reproducibility.main(require_flags=False) != 0:
        return 1
    # FROM THIS POINT THE ARTIFACT BYTES ARE PINNED. Not to the caller's shell
    # -- `build` overwrites the variable with the value derived from the homes
    # above -- but to those two directories. A stale export left in a shell from
    # an older CARGO_HOME therefore cannot silently produce bytes nobody's
    # descriptor pins.
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

#!/usr/bin/env python3
"""Run a consumer of the generated wasm bindings, or refuse with the fix.

``packages/vue/src/wasm/{qr,mermaid,scene3d,highlight}/`` is jco output: it is
gitignored and produced only by ``packages/wasm/build.py``. Everything in the
Vue layer that touches those components — the composables, their suites and
``vue-tsc`` — imports the bindings for real, so in a fresh clone the first
``pnpm test`` / ``pnpm lint`` fails with two shapes that name neither the cause
nor the fix:

* vitest dies with a *transform* error (``Failed to resolve import …``) even
  though the import is inside ``try`` / ``catch``, so a test that wisely guards
  the optional surface never gets to run;
* ``vue-tsc`` prints ``TS2307: Cannot find module`` plus a tail of ``TS7006``
  implicit-``any`` errors, which read like a type regression in shipped code.

This driver turns both into one line that says what to run. It is wired as the
``pretest`` / ``prebuild`` / ``prelint`` hook in ``packages/vue/package.json``,
so ``pnpm test`` in a fresh clone builds the bindings first (the workspace's
clone-and-one-command rebuild path) and only then runs the suite.

        python3 packages/wasm/ensure_bindings.py vitest run -- <args>
        python3 packages/wasm/ensure_bindings.py vue-tsc --noEmit

Direct commands, same effect:

        python3 packages/wasm/build.py            # every component
        python3 packages/wasm/build.py qr         # one component

Requires the Rust ``wasm32-wasip2`` target and ``jco`` on PATH.
"""
import pathlib
import shutil
import subprocess
import sys

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent.parent
BINDINGS = ROOT / "packages" / "vue" / "src" / "wasm"
COMPONENTS = ("qr", "mermaid", "scene3d", "highlight")
BUILD = HERE / "build.py"

FIX = (
    "error: the hikari wasm bindings are not built.\n"
    f"       missing: {BINDINGS}/{{{','.join(COMPONENTS)}}}/\n"
    "       They are jco output and are not checked in — build them once:\n"
    "         python3 packages/wasm/build.py\n"
    "       (needs the Rust wasm32-wasip2 target and `jco` on PATH;\n"
    "        `pnpm test` / `pnpm lint` run this automatically via a pre* hook)"
)


def missing() -> list[str]:
    """The components whose generated entry module is absent."""
    return [c for c in COMPONENTS if not (BINDINGS / c / f"hikari_wasm_{c}.js").is_file()]


def explain() -> None:
    print(FIX, file=sys.stderr)
    absent = [name for name in ("cargo", "jco") if shutil.which(name) is None]
    if absent:
        hint = {
            "cargo": "install Rust (rustup) and run `rustup target add wasm32-wasip2`",
            "jco": "run `npm install -g @bytecodealliance/jco`",
        }
        print(
            f"       note: {' and '.join(absent)} "
            f"{'is' if len(absent) == 1 else 'are'} not on PATH — "
            + "; ".join(hint[name] for name in absent)
            + " before the build can run",
            file=sys.stderr,
        )


def ensure_built() -> int:
    """Build the bindings if any component is missing; ``0`` when they are there."""
    absent = missing()
    if not absent:
        return 0
    print(f"── wasm bindings missing ({', '.join(absent)}) — building…", flush=True)
    try:
        result = subprocess.run([sys.executable, str(BUILD)], cwd=ROOT)
    except FileNotFoundError:
        # build.py itself shells out to cargo/jco; a missing one raises there.
        explain()
        return 127
    if result.returncode != 0:
        explain()
        return result.returncode
    absent = missing()
    if absent:
        explain()
        return 1
    return 0


def main(argv: list[str]) -> int:
    status = ensure_built()
    if status != 0:
        return status
    if not argv:
        return 0
    try:
        return subprocess.run(argv, cwd=ROOT).returncode
    except FileNotFoundError:
        print(f"error: {argv[0]!r} is not on PATH", file=sys.stderr)
        return 127


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
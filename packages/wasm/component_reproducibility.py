#!/usr/bin/env python3
"""component-reproducibility - the wasm artifacts must not carry host paths.

*Why this exists:* the four descriptors (``packages/wasm/<c>/component.toml``)
pin a ``sha256`` of the built ``.wasm``, and akivili's registry compares that
digest at **scan, feed and pack** -- a mismatch rejects the plugin, it is not a
warning. For that digest to describe *the component* rather than *the machine
that built it*, the artifact bytes have to be the same everywhere. They were
not.

The mechanism is rustc, not wit-bindgen and not the target directory: a release
build inlines the third-party crates it actually uses (``qrcode`` for qr,
``pest`` for mermaid, ``pest`` + ``memchr`` for highlight), and every inlined
``panic!``-capable file contributes its **absolute source path** to the core
module's data section -- ``<CARGO_HOME>/registry/src/<crate>/src/<file>.rs``.
``core``/``alloc`` contribute their own absolute paths
(``<RUSTUP_HOME>/toolchains/<toolchain>/lib/rustlib/src/rust/library/...``).
Change either home and the bytes change; ``component_descriptor.py`` then
reports a digest mismatch for a component nobody touched.

*The fix is a per-target remap, and where it lives is load-bearing:*

``--remap-path-prefix=<dir>=<canonical>`` teaches rustc to print the canonical
prefix instead of the real one. It has to reach **every** entry point that
builds a wasm artifact (``packages/wasm/build.py``, the tairitsu packager's
``build_wasm_component``, a hand-run ``cargo build --target wasm32-wasip2``),
and it has to be derivable from the *ambient* ``CARGO_HOME`` -- which is why it
is a ``rustflags`` string and not a checked-in constant.

Two spellings express it, and they are **not** equivalent:

* ``[target.wasm32-wasip2] rustflags = [...]`` in ``.cargo/config.toml``. This
  *looks* narrow and is not: measured on hikari 2026-11-24, a native
  ``cargo check -p hikari-components`` against a clean target wrote **1650**
  fingerprint files under ``debug/build/*/*/fingerprint`` where the no-flag
  baseline writes 825 -- the same 825 extra units, byte-identical in shape,
  that a global ``RUSTFLAGS`` produces (180 of them carry the flag string in
  ``lib-*.json``'s ``rustflags``). Cargo folds ``[target.<triple>] rustflags``
  into the fingerprint of every compiled unit, host target included, so a
  checked-in table there means a full rebuild on every CI run.
* ``CARGO_TARGET_WASM32_WASIP2_RUSTFLAGS`` -- cargo's per-target environment
  variable. Same 825/825 fingerprints, byte-identical to the no-flag baseline;
  the flag reaches only wasm32-wasip2 compilation.

So the value is an environment variable, and its two operands are the two
ambient homes. **This module is the single place that spells it out**: the
gate below refuses a build whose environment does not carry it, and names the
``export`` that fixes it. A developer who forgets sees one actionable line
instead of a digest mismatch on three of four components.

*What it does NOT claim:* remapping normalizes *strings*, not bytes. The rest
of reproducibility (same toolchain, same ``Cargo.lock``, same profile) is
cargo's usual guarantee and is not re-checked here -- this gate answers one
question, "were the host paths in this environment normalized?".
"""

from __future__ import annotations

import os
import sys
from dataclasses import dataclass

#: Where remapped home prefixes are rewritten to. Fixed constants, deliberately
#: short and machine-neutral: the artifact bytes contain whatever text is on the
#: right of the ``=``, so this value is part of the reproducibility contract. Do
#: not "tidy" it into ``/opt/cargo`` -- that is a different string, and every
#: descriptor digest would have to be re-pinned.
CARGO_HOME_REMAP = "/cargo"
RUSTUP_HOME_REMAP = "/rustup"

#: The variable cargo interrogates for wasm32-wasip2 compilations. Spelled once
#: here so the gate's message and any caller agree on it.
RUSTFLAGS_VAR = "CARGO_TARGET_WASM32_WASIP2_RUSTFLAGS"

#: Home directories whose absolute paths rustc bakes into an artifact. Each is
#: remapped to the constant above. ``CARGO_HOME`` covers the inlined
#: third-party sources (``<home>/registry/src/<crate>/...``); ``RUSTUP_HOME``
#: covers ``core``/``alloc`` (``<home>/toolchains/<t>/lib/rustlib/src/rust/...``).
#: A home that is unset is not guessed: cargo and rustup would each fall back to
#: ``~/.cargo`` / ``~/.rustup``, and silently remapping a different string than
#: the one the toolchain uses would look normalized while changing nothing.
REMAPPED_HOMES = ("CARGO_HOME", "RUSTUP_HOME")

_REMAP_TARGETS = {"CARGO_HOME": CARGO_HOME_REMAP, "RUSTUP_HOME": RUSTUP_HOME_REMAP}


def _normalize(path: str) -> str:
    """Strip trailing separators so ``/x/`` and ``/x`` compare and remap alike."""
    return path.rstrip("/") or "/"


@dataclass(frozen=True)
class ReproProblem:
    """One reason the current environment cannot produce a reproducible artifact."""

    variable: str
    detail: str


def _flag_for(home_var: str, value: str, flags: list[str]) -> str:
    return f"--remap-path-prefix={_normalize(value)}={_REMAP_TARGETS[home_var]}"


def problems(
    environ: dict[str, str] | None = None, *, require_flags: bool = True
) -> list[ReproProblem]:
    """Every way ``environ`` fails the reproducibility contract, in a stable order.

    Read-only and total: an empty list means the environment carries both
    remaps. Three failure shapes, each reported separately because they need
    different fixes:

    1. a home the toolchain will bake in is **unset**, so no remap can be
       derived for it;
    2. ``CARGO_TARGET_WASM32_WASIP2_RUSTFLAGS`` carries neither remap;
    3. it carries one but not the other -- the shape that survives review,
       because it *does* change the artifact and the remaining home still
       leaks.

    ``require_flags=False`` checks the homes alone. That is the shape a caller
    that INJECTS the value needs: ``build.py`` overwrites the variable from
    these same homes, so a stale export in somebody's shell neither helps nor
    hurts it, and refusing on one would be advice no reader can act on.
    """
    env = os.environ if environ is None else environ
    found: list[ReproProblem] = []
    raw = env.get(RUSTFLAGS_VAR, "")
    flags = raw.split()

    for home_var in REMAPPED_HOMES:
        value = env.get(home_var)
        if not value:
            found.append(
                ReproProblem(
                    home_var,
                    f"{home_var} is unset, so the path rustc would bake into a wasm "
                    f"artifact cannot be derived. Set it (cargo/rustup default to "
                    f"~/.cargo and ~/.rustup) and export {RUSTFLAGS_VAR} as below.",
                )
            )
            continue
        if not require_flags:
            continue
        expected = _flag_for(home_var, value, flags)
        if expected not in flags:
            # Name the home AND the flag it needs: "one remap is missing" is
            # actionable only if the reader knows which -- and this is the shape
            # that survives review, because the artifact does change, just not
            # into the one the descriptors pin.
            found.append(
                ReproProblem(
                    RUSTFLAGS_VAR,
                    f"{RUSTFLAGS_VAR} does not carry {expected!r} for {home_var}={value}, "
                    f"so that path would appear verbatim in the artifact and the "
                    f"descriptor digests would depend on this machine",
                )
            )
    return found


def export_line(environ: dict[str, str] | None = None) -> str | None:
    """The shell line that satisfies :func:`problems`, or ``None`` without homes.

    Returned as text rather than applied: this gate runs in a process whose
    environment cannot influence a build it does not start, so telling the
    caller what to export is the only honest output. ``None`` means an operand
    is missing and no line can be complete -- :func:`problems` names which.
    """
    env = os.environ if environ is None else environ
    homes = {name: env.get(name) for name in REMAPPED_HOMES}
    if not all(homes.values()):
        return None
    flags = " ".join(_flag_for(name, str(value), []) for name, value in homes.items())
    return f'export {RUSTFLAGS_VAR}="{flags}"'


def rustflags(environ: dict[str, str] | None = None) -> str | None:
    """The value cargo must see, or ``None`` when a home is unset.

    :func:`export_line` strips the ``export VAR=`` wrapper off this; the two are
    one derivation so the build and the printed advice can never disagree about
    what a correct value is.
    """
    line = export_line(environ)
    if line is None:
        return None
    return line.split('"', 2)[1]


def main(*, require_flags: bool = True) -> int:
    failures = problems(require_flags=require_flags)
    if not failures:
        print(
            f"component-reproducibility: OK {RUSTFLAGS_VAR} normalizes "
            f"{' and '.join(REMAPPED_HOMES)}"
        )
        return 0
    for failure in failures:
        print(f"FAIL {failure.variable}: {failure.detail}", file=sys.stderr)
    line = export_line()
    if line is None:
        print(
            f"component-reproducibility: cannot name a complete export -- "
            f"{' and '.join(REMAPPED_HOMES)} must both be set",
            file=sys.stderr,
        )
    else:
        # The homes whose flag is MISSING still have to be exported: printing
        # the line beside their current values makes the runbook
        # copy-paste-and-go for any path, not just this machine's ~/.cargo.
        missing = [
            f"{name}={os.environ.get(name, '')}"
            for name in REMAPPED_HOMES
            for problem in failures
            if name in problem.detail
        ]
        prefix = f"export {' '.join(missing)}" if missing else "export"
        print(
            f"component-reproducibility: build the components with\n"
            f"  {prefix}\n  {line}\n"
            f"otherwise the .wasm artifacts carry this machine's paths and the "
            f"descriptor sha256 values pin a random number",
            file=sys.stderr,
        )
    return 1


if __name__ == "__main__":
    sys.exit(main())

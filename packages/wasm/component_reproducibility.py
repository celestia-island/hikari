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
prefix instead of the real one. The value has to be derived from the *ambient*
``CARGO_HOME`` / ``RUSTUP_HOME`` (they differ per machine and per lane), so it
is a ``rustflags`` string, not a checked-in constant.

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

**The per-target variable is silently discarded when a global ``RUSTFLAGS`` is
set** (measured: with both exported, ``cargo build -v`` shows the global value
three times and the per-target remap zero times). That is why the gate below
refuses a global ``RUSTFLAGS`` rather than assuming the narrower variable wins.
``.github/workflows/ci.yml`` exports ``RUSTFLAGS: '--cfg releasing'`` in its
clippy steps; none of them builds an artifact today, and if one starts to, it
fails loudly here instead of writing bytes no descriptor pins.

*Unset homes are resolved, not refused:* cargo and rustup fall back to
``~/.cargo`` / ``~/.rustup``, so that IS the directory whose path rustc bakes
in. Refusing there made a stock GitHub runner (which sets neither variable)
fail a build that used to work -- the regression this branch's review round 2
caught. The defaults are what a bare ``rustup``-installed toolchain actually
uses; a caller who wants a different home exports it and the default is not
consulted.

**This module is the single place that spells the contract out**: the gate
refuses a build whose environment cannot produce pinned bytes, and prints the
``export`` line that fixes it. ``packages/wasm/build.py`` imports
:func:`rustflags` and injects the value into its own ``cargo build``.

*Entry points this covers, and the one it does not:* ``packages/wasm/build.py``
(injects the value) and any caller that runs the gate and passes its output.
A **bare** ``cargo build --target wasm32-wasip2`` in this workspace is NOT
covered -- deliberately, because covering it needs the ``[target.<triple>]``
table that costs a full rebuild (above). The tairitsu packager's
``build_wasm_component`` is also not covered; it lives in another repository
and would need its own env injection.

*What it does NOT claim:* remapping normalizes *strings*, not bytes. The rest
of reproducibility (same toolchain, same ``Cargo.lock``, same profile) is
cargo's usual guarantee and is not re-checked here -- this gate answers one
question, "will this environment's host paths reach the artifact?".
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

#: The variable that OVERRIDES it. Cargo ignores every per-target rustflags
#: variable once this is set, which turns a "working" build into one whose bytes
#: carry host paths while the gate's own variable looks satisfied.
GLOBAL_RUSTFLAGS_VAR = "RUSTFLAGS"

#: Home directories whose absolute paths rustc bakes into an artifact, with the
#: fallback cargo/rustup use when the variable is unset. ``CARGO_HOME`` covers
#: the inlined third-party sources (``<home>/registry/src/<crate>/...``);
#: ``RUSTUP_HOME`` covers ``core``/``alloc``
#: (``<home>/toolchains/<t>/lib/rustlib/src/rust/...``).
#:
#: The fallbacks are not guesses: both tools document them and both are what a
#: plain rustup install uses, which is exactly the shape of a stock CI runner.
REMAPPED_HOMES = ("CARGO_HOME", "RUSTUP_HOME")

_REMAP_TARGETS = {"CARGO_HOME": CARGO_HOME_REMAP, "RUSTUP_HOME": RUSTUP_HOME_REMAP}

#: Characters that make a home unusable as a remap operand. ``--remap-path-prefix``
#: is one argv entry, so a space would split the flag and a ``"`` makes the
#: printed ``export`` line ambiguous. Neither occurs on a real toolchain install;
#: both are refused rather than guessed at.
_HOSTILE_HOME_CHARS = (" ", '"', "'")


def _default_home(home_var: str) -> str:
    """Where cargo/rustup look when ``home_var`` is unset."""
    leaf = ".cargo" if home_var == "CARGO_HOME" else ".rustup"
    return os.path.join(os.path.expanduser("~"), leaf)


def resolve_home(home_var: str, environ: dict[str, str] | None = None) -> str:
    """The directory whose absolute path this build would bake in.

    ``environ`` is read the same way the toolchain reads it: an empty value
    counts as unset (rustup treats ``RUSTUP_HOME=""`` as unset too), and unset
    resolves to :func:`_default_home`.
    """
    env = os.environ if environ is None else environ
    return env.get(home_var) or _default_home(home_var)


def _normalize(path: str) -> str:
    """Strip trailing separators so ``/x/`` and ``/x`` compare and remap alike."""
    return path.rstrip("/") or "/"


@dataclass(frozen=True)
class ReproProblem:
    """One reason the current environment cannot produce a reproducible artifact."""

    variable: str
    detail: str


def _flag_for(home_var: str, value: str) -> str:
    return f"--remap-path-prefix={_normalize(value)}={_REMAP_TARGETS[home_var]}"


def _unusable_home(home_var: str, value: str) -> str | None:
    """Why ``value`` cannot be a remap operand, or ``None`` when it can.

    Two refusals, both about producing a *nonsense* flag rather than a wrong
    one: a character that splits the argv entry or the printed report, and the
    filesystem root -- remapping ``/`` rewrites every absolute path in the
    artifact (``/home/...``, ``/tmp/...``, the workspace itself) to ``/cargo``
    and the gate would happily call that normalized.
    """
    for bad in _HOSTILE_HOME_CHARS:
        if bad in value:
            return (
                f"{home_var}={value!r} contains {bad!r}, which cannot appear in a "
                f"--remap-path-prefix operand or in the printed export line -- "
                f"point {home_var} at a path without quotes or spaces"
            )
    if _normalize(value) == "/":
        return (
            f"{home_var}=/ would remap the filesystem root, rewriting every "
            f"absolute path in the artifact (not just this toolchain's) -- "
            f"point {home_var} at the directory cargo/rustup actually use"
        )
    if not os.path.isabs(value):
        return (
            f"{home_var}={value!r} is not an absolute path, so it is not the string "
            f"rustc would bake in"
        )
    return None


def problems(
    environ: dict[str, str] | None = None, *, require_flags: bool = True
) -> list[ReproProblem]:
    """Every way ``environ`` fails the reproducibility contract, in a stable order.

    Read-only and total: an empty list means a build here produces the pinned
    bytes. Six failure shapes, each reported separately because they need
    different fixes:

    1. a global ``RUSTFLAGS`` is set -- it *replaces* the per-target variable,
       so this build is un-remapped no matter what the variable says;
    2. a home value cannot be a remap operand (quote/space, ``/``, relative);
    3. ``CARGO_TARGET_WASM32_WASIP2_RUSTFLAGS`` carries neither remap;
    4. it carries one but not the other -- the shape that survives review,
       because it *does* change the artifact and the remaining home still
       leaks;
    5. it names a home this process would not resolve (a stale export pointing
       at a directory that is not the one in use);
    6. (``require_flags=False`` only) nothing but the homes is checked.

    ``require_flags=False`` is the shape a caller that INJECTS the value needs:
    ``build.py`` overwrites the variable from these same homes, so a stale
    export in somebody's shell neither helps nor hurts it, and refusing on one
    would be advice no reader can act on. A global ``RUSTFLAGS`` is still
    refused in that mode, because overwriting the per-target variable does not
    help against it.

    A home that is unset is NOT a problem: :func:`resolve_home` supplies the
    fallback cargo/rustup use.
    """
    env = os.environ if environ is None else environ
    found: list[ReproProblem] = []

    if env.get(GLOBAL_RUSTFLAGS_VAR):
        found.append(
            ReproProblem(
                GLOBAL_RUSTFLAGS_VAR,
                f"{GLOBAL_RUSTFLAGS_VAR} is set, and cargo discards every "
                f"per-target rustflags variable when it is -- measured: with both "
                f"exported, `cargo build -v` shows the global value three times and "
                f"the per-target remap zero times. Build this target with "
                f"{GLOBAL_RUSTFLAGS_VAR} unset (put per-target cfg in "
                f"{RUSTFLAGS_VAR} instead), or the artifact carries host paths",
            )
        )

    homes = {name: resolve_home(name, env) for name in REMAPPED_HOMES}
    for home_var, value in homes.items():
        unusable = _unusable_home(home_var, value)
        if unusable is not None:
            found.append(ReproProblem(home_var, unusable))

    if not require_flags:
        return found

    raw = env.get(RUSTFLAGS_VAR, "")
    flags = raw.split()
    for home_var, value in homes.items():
        expected = _flag_for(home_var, value)
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
        # A flag for a DIFFERENT path of the same home is worse than a missing
        # one: the gate's operand says "normalized" while the .wasm carries the
        # path in use. Compare pointers, not just presence.
        stale = sorted(
            flag
            for flag in flags
            if flag.startswith("--remap-path-prefix=")
            and flag.endswith(f"={_REMAP_TARGETS[home_var]}")
            and flag != expected
        )
        if stale:
            found.append(
                ReproProblem(
                    RUSTFLAGS_VAR,
                    f"{RUSTFLAGS_VAR} remaps {stale[0]!r} to {_REMAP_TARGETS[home_var]} "
                    f"but this process resolves {home_var} to {value!r} -- "
                    f"a leftover export from another home; re-derive it with "
                    f":func:`export_line`",
                )
            )
    return found


def export_line(environ: dict[str, str] | None = None) -> str:
    """The shell lines that satisfy :func:`problems`, home values included.

    Returned as text rather than applied: this gate runs in a process whose
    environment cannot influence a build it does not start, so telling the
    caller what to export is the only honest output. The home assignments come
    first and only name values that were explicit -- a fallback (``~/.cargo``)
    needs no export, it is already in effect.
    """
    env = os.environ if environ is None else environ
    explicit = [f"{name}={env[name]}" for name in REMAPPED_HOMES if env.get(name)]
    flags = " ".join(
        _flag_for(name, resolve_home(name, env)) for name in REMAPPED_HOMES
    )
    lines = []
    if explicit:
        lines.append(f"export {' '.join(explicit)}")
    lines.append(f'export {RUSTFLAGS_VAR}="{flags}"')
    return "\n".join(lines)


def rustflags(environ: dict[str, str] | None = None) -> str:
    """The value ``cargo build --target wasm32-wasip2`` must see.

    One derivation with :func:`export_line` (this is its second line, unwrapped),
    so the build and the printed advice can never disagree about what a correct
    value is.
    """
    return export_line(environ).splitlines()[-1].split('"', 2)[1]


def main(*, require_flags: bool = True) -> int:
    failures = problems(require_flags=require_flags)
    if not failures:
        homes = " and ".join(f"{name}={resolve_home(name)}" for name in REMAPPED_HOMES)
        print(f"component-reproducibility: OK {RUSTFLAGS_VAR} normalizes {homes}")
        return 0
    for failure in failures:
        print(f"FAIL {failure.variable}: {failure.detail}", file=sys.stderr)
    # Print the fix unless a home value is itself unusable: an export line
    # derived from a path with a quote in it is the very thing being refused.
    blocked = {p.variable for p in failures} - {RUSTFLAGS_VAR, GLOBAL_RUSTFLAGS_VAR}
    if blocked:
        print(
            f"component-reproducibility: fix {' and '.join(sorted(blocked))} first -- "
            f"no export line can be complete while it is unusable",
            file=sys.stderr,
        )
    else:
        print(
            f"component-reproducibility: build with\n"
            f"{_indent(export_line())}\n"
            f"otherwise the .wasm artifacts carry this machine's paths and the "
            f"descriptor sha256 values pin a random number",
            file=sys.stderr,
        )
    return 1


def _indent(text: str) -> str:
    return "\n".join(f"  {line}" for line in text.splitlines())


if __name__ == "__main__":
    sys.exit(main())

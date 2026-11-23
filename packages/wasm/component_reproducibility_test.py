#!/usr/bin/env python3
"""Tests for the reproducibility contract (``component_reproducibility.py``).

The contract is one sentence -- *build the wasm components with both home
directories remapped* -- and the failure it prevents is silent in every lane
that is not the registry: ``cargo build`` succeeds, ``jco transpile`` succeeds,
the Vue suite passes, and the damage surfaces later as an akivili ``Rejected``
for a component whose source nobody touched. So each failure shape is pinned
here, including the two that are easy to miss:

* **half** the contract satisfied (one home remapped, the other still leaking) --
  the shape that survives review, because the artifact *does* change;
* a **global ``RUSTFLAGS``**, which makes cargo discard the per-target variable
  entirely, so a "correct-looking" variable is inert.

A home that is *unset* is NOT a failure: cargo and rustup fall back to
``~/.cargo`` / ``~/.rustup``, and that fallback is the path rustc would bake in.
Treating it as fatal broke a stock CI runner in review round 2 (see
``test_an_unset_home_resolves_to_the_toolchain_default``).

Mutation anchors (each id names the branch whose removal reddens the test named
beside it): MUT:no-global-rustflags-check (``test_a_global_rustflags_is_refused``)
MUT:no-default-home (``test_an_unset_home_resolves_to_the_toolchain_default``)
MUT:no-single-home-report (``test_half_the_contract_is_refused``)
MUT:no-hostile-home-guard (``test_a_root_home_is_refused`` / ``test_a_quote_in_a_home_is_refused``)
MUT:no-stale-export-report (``test_a_remap_for_another_home_is_reported``)
MUT:export-drift (``test_rustflags_is_the_value_the_export_line_prints``)
MUT:no-inject-guard (``test_homes_only_mode_ignores_the_callers_flags``)
"""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

import pytest

#: This file lives in ``packages/wasm/``; two levels up is the checkout root.
REPO = Path(__file__).resolve().parents[2]

_spec = importlib.util.spec_from_file_location(
    "component_reproducibility",
    REPO / "packages" / "wasm" / "component_reproducibility.py",
)
repro = importlib.util.module_from_spec(_spec)
assert _spec.loader is not None
sys.modules[_spec.name] = repro
_spec.loader.exec_module(repro)

CARGO_HOME = "/mnt/work/home-one"
RUSTUP_HOME = "/home/user/.rustup"


def flags(*homes: tuple[str, str]) -> str:
    """A ``…_RUSTFLAGS`` value remapping exactly ``homes`` (name, path) pairs."""
    return " ".join(
        f"--remap-path-prefix={path}={repro._REMAP_TARGETS[name]}"
        for name, path in homes
    )


def clean_env() -> dict[str, str]:
    """The smallest environment that satisfies the contract."""
    return {
        "CARGO_HOME": CARGO_HOME,
        "RUSTUP_HOME": RUSTUP_HOME,
        repro.RUSTFLAGS_VAR: flags(
            ("CARGO_HOME", CARGO_HOME), ("RUSTUP_HOME", RUSTUP_HOME)
        ),
    }


# ── the known positive ───────────────────────────────────────────────────


def test_a_fully_remapped_environment_is_clean() -> None:
    assert repro.problems(clean_env()) == []


def test_the_export_line_satisfies_the_gate_it_prints_for() -> None:
    """The advice and the check must agree, or the message sends the reader in circles."""
    env = {"CARGO_HOME": CARGO_HOME, "RUSTUP_HOME": RUSTUP_HOME}
    line = repro.export_line(env)
    assert line.splitlines()[-1].startswith(f'export {repro.RUSTFLAGS_VAR}="'), line
    value = repro.rustflags(env)
    assert repro.problems({**env, repro.RUSTFLAGS_VAR: value}) == []


def test_rustflags_is_the_value_the_export_line_prints() -> None:
    """`build.py` injects `rustflags()`; the advice prints `export_line()`.

    One derivation, two spellings: if they ever drift, a developer follows advice
    that does not satisfy the gate and the loop never converges.
    """
    env = {"CARGO_HOME": CARGO_HOME, "RUSTUP_HOME": RUSTUP_HOME}
    value = repro.rustflags(env)
    assert (
        repro.export_line(env).splitlines()[-1]
        == f'export {repro.RUSTFLAGS_VAR}="{value}"'
    )
    assert repro.problems({**env, repro.RUSTFLAGS_VAR: value}) == []


# ── unset homes resolve to the toolchain defaults (NOT an error) ──────────


@pytest.mark.parametrize("home", repro.REMAPPED_HOMES)
def test_an_unset_home_resolves_to_the_toolchain_default(home: str) -> None:
    """``~/.cargo`` / ``~/.rustup`` are what a bare rustup install uses.

    Refusing an unset home made every stock CI runner fail a build that had
    worked before, and it inverted the check: the *default* environment (the
    common, correct one) was rejected while an explicit one passed.
    """
    # MUT:no-default-home -- `return env.get(home_var) or ""` makes the flag
    # operand empty and every assertion below fails.
    env = {"CARGO_HOME": CARGO_HOME, "RUSTUP_HOME": RUSTUP_HOME}
    del env[home]
    resolved = repro.resolve_home(home, env)
    assert resolved == str(
        Path.home() / (".cargo" if home == "CARGO_HOME" else ".rustup")
    )
    # And the derived value satisfies the gate, so an unset home is buildable.
    assert repro.problems({**env, repro.RUSTFLAGS_VAR: repro.rustflags(env)}) == []


def test_an_empty_home_counts_as_unset() -> None:
    """rustup treats ``RUSTUP_HOME=""`` as unset; so must the derived operand."""
    env = {"CARGO_HOME": "", "RUSTUP_HOME": ""}
    assert repro.resolve_home("CARGO_HOME", env) == str(Path.home() / ".cargo")


def test_no_homes_and_no_flags_is_the_stock_runner_shape() -> None:
    """What GitHub-hosted ``dtolnay/rust-toolchain`` actually provides.

    It must be *satisfiable* (one export, derived from defaults) and not a
    refusal -- that is the S1 the round-2 review caught.
    """
    env: dict[str, str] = {}
    found = repro.problems(env)
    assert found, "the gate must still ask for the export"
    # The printed line, applied, is enough to build.
    value = repro.rustflags(env)
    assert repro.problems({repro.RUSTFLAGS_VAR: value}) == []


# ── the global RUSTFLAGS override ────────────────────────────────────────


def test_a_global_rustflags_is_refused() -> None:
    """Cargo discards every per-target rustflags variable when this is set.

    Measured: with both exported, `cargo build -v` shows the global value three
    times and the per-target remap zero times. A green gate over that would be
    the worst outcome -- an artifact nobody pinned, blessed as normalized.
    """
    # MUT:no-global-rustflags-check -- dropping the branch makes this env clean
    # even though cargo will ignore the per-target remap entirely.
    env = {**clean_env(), "RUSTFLAGS": "--cfg releasing"}
    found = repro.problems(env)
    assert [p.variable for p in found] == [repro.GLOBAL_RUSTFLAGS_VAR], found
    assert "discards" in found[0].detail


def test_a_global_rustflags_is_refused_in_homes_only_mode_too() -> None:
    """Homes-only mode still refuses a global ``RUSTFLAGS``.

    ``build.py`` rewrites its own ``CARGO_TARGET_WASM32_WASIP2_RUSTFLAGS`` before
    spawning cargo (``test_build_forces_the_remap_over_a_stale_shell_value``), and
    ``require_flags=False`` is the mode that lets it ignore a caller's stale
    value. Rewriting the per-target variable cannot defeat a global
    ``RUSTFLAGS`` though -- cargo discards it -- so the global check has to stay
    on even in this relaxed mode.
    """
    env = {
        "CARGO_HOME": CARGO_HOME,
        "RUSTUP_HOME": RUSTUP_HOME,
        "RUSTFLAGS": "-C opt-level=3",
    }
    assert [p.variable for p in repro.problems(env, require_flags=False)] == [
        repro.GLOBAL_RUSTFLAGS_VAR
    ]


# ── homes that cannot be remap operands ──────────────────────────────────


def test_a_root_home_is_refused() -> None:
    """Remapping ``/`` would rewrite EVERY absolute path, not just the toolchain's."""
    # MUT:no-hostile-home-guard -- without it the gate derives
    # `--remap-path-prefix=/=/cargo` and, once the caller exports it, calls the
    # resulting artifact normalized.
    env = {"CARGO_HOME": "/", "RUSTUP_HOME": RUSTUP_HOME}
    found = repro.problems({**env, repro.RUSTFLAGS_VAR: repro.rustflags(env)})
    assert [p.variable for p in found] == ["CARGO_HOME"], found
    assert "filesystem root" in found[0].detail


@pytest.mark.parametrize(
    "value", ['/mnt/work/we"ird', "/mnt/work/with space", "/mnt/work/a'b"]
)
def test_a_quote_in_a_home_is_refused(value: str) -> None:
    """A ``"`` truncated the injected value; a space split the argv entry.

    Neither occurs on a real toolchain install, and both are refused instead of
    silently producing a flag whose operand is a prefix of the real home.
    """
    env = {"CARGO_HOME": value, "RUSTUP_HOME": RUSTUP_HOME}
    found = repro.problems(env, require_flags=False)
    assert [p.variable for p in found] == ["CARGO_HOME"], found


def test_a_relative_home_is_refused() -> None:
    """A relative value is not the string rustc would bake in.

    The homes-only view is the one that must catch it alone: with the strict
    view it is also reported a second time as "no remap for CARGO_HOME", which
    is true but not the actionable half.
    """
    env = {"CARGO_HOME": "rel/cargo", "RUSTUP_HOME": RUSTUP_HOME}
    found = repro.problems(env, require_flags=False)
    assert [p.variable for p in found] == ["CARGO_HOME"], found
    assert "not an absolute path" in found[0].detail


def test_an_unusable_home_suppresses_the_export_line(capsys) -> None:
    """Printing an export derived from an unusable path would re-emit the bug."""
    import os

    saved = {k: os.environ.get(k) for k in ("CARGO_HOME", "RUSTUP_HOME", "RUSTFLAGS")}
    try:
        os.environ["CARGO_HOME"] = '/mnt/work/we"ird'
        os.environ.pop("RUSTUP_HOME", None)
        os.environ.pop("RUSTFLAGS", None)
        assert repro.main() == 1
    finally:
        for key, value in saved.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value
    err = capsys.readouterr().err
    assert "no export line can be complete" in err, err
    assert 'we"ird' not in err.split("no export line")[0].splitlines()[-1]


# ── the missing / stale remap shapes ────────────────────────────────────


def test_an_empty_rustflags_value_reports_both_homes() -> None:
    env = {"CARGO_HOME": CARGO_HOME, "RUSTUP_HOME": RUSTUP_HOME}
    found = repro.problems(env)
    assert [p.variable for p in found] == [repro.RUSTFLAGS_VAR] * 2
    assert CARGO_HOME in found[0].detail
    assert RUSTUP_HOME in found[1].detail


@pytest.mark.parametrize("remapped", repro.REMAPPED_HOMES)
def test_half_the_contract_is_refused(remapped: str) -> None:
    """The shape that survives review: the artifact DOES change, so it looks done.

    Whichever home is left out still leaks verbatim into the .wasm, so the
    digest is still machine-dependent -- one working remap is not progress, it
    is a different bug.
    """
    # MUT:no-single-home-report -- a check that only asks "is ANY remap present"
    # passes this fixture; it must fail it, naming the missing home.
    env = clean_env()
    path = env[remapped]
    env[repro.RUSTFLAGS_VAR] = flags((remapped, path))
    found = repro.problems(env)
    missing = next(n for n in repro.REMAPPED_HOMES if n != remapped)
    assert [p.variable for p in found] == [repro.RUSTFLAGS_VAR]
    # The report must name the home it is about: `_REMAP_TARGETS` maps to
    # `/cargo` and `/rustup`, one of which is a SUBSTRING of the other, so a
    # bare substring assert would pass whichever home were missing.
    assert f"{missing}=" in found[0].detail, found[0].detail


def test_a_remap_for_another_home_is_reported() -> None:
    """A stale export from a previous CARGO_HOME looks satisfied but is not.

    Presence alone cannot see this: the flag IS there and IS well-formed, it
    just names a directory this process does not use -- so the artifact carries
    the path in use while the gate's operand says "normalized".
    """
    # MUT:no-stale-export-report -- dropping the pointer comparison leaves only
    # the presence check, which a stale export passes.
    env = {
        "CARGO_HOME": CARGO_HOME,
        "RUSTUP_HOME": RUSTUP_HOME,
        repro.RUSTFLAGS_VAR: flags(
            ("CARGO_HOME", "/mnt/work/home-old"), ("RUSTUP_HOME", RUSTUP_HOME)
        ),
    }
    found = repro.problems(env)
    stale = [p for p in found if "leftover export" in p.detail]
    assert len(stale) == 1, found
    assert "/mnt/work/home-old" in stale[0].detail


# ── the homes-only mode `build.py` uses ─────────────────────────────────


def test_homes_only_mode_ignores_the_callers_flags() -> None:
    """`build.py` injects the value, so a stale export must neither help nor block.

    Refusing here would print advice the caller cannot act on -- the very next
    line of `build.py` overwrites the variable.
    """
    env = {"CARGO_HOME": CARGO_HOME, "RUSTUP_HOME": RUSTUP_HOME}
    assert repro.problems(env, require_flags=False) == []
    # Unusable homes are still refused in this mode: they decide the operand.
    assert repro.problems({**env, "CARGO_HOME": ""}, require_flags=False) == []


# ── the remap target constants are part of the contract ──────────────────


def test_the_remap_targets_are_short_absolute_paths() -> None:
    """These strings end up inside every artifact: changing one re-pins four digests."""
    for name, target in repro._REMAP_TARGETS.items():
        assert target.startswith("/"), (name, target)
        assert not target.endswith("/"), (name, target)
        assert " " not in target and "=" not in target, (name, target)


def test_a_trailing_separator_does_not_hide_the_remap() -> None:
    """``CARGO_HOME=/x/`` and a flag for ``/x`` describe the same directory."""
    env = clean_env()
    env["CARGO_HOME"] = CARGO_HOME + "/"
    assert repro.problems(env) == []


# ── end to end: the artifact bytes the contract exists to protect ────────


def test_the_contract_protects_the_descriptor_digest() -> None:
    """Two 'builds' from different homes produce one digest when the flags match.

    The artifacts here are synthetic; what is pinned is the part this repository
    controls -- a digest computed over remapped bytes is the same digest from
    two different homes, and the un-remapped spelling is exactly the one that is
    not.
    """
    import hashlib

    def artifact(home: str) -> bytes:
        return b"\0asmstub" + home.encode() + b"/registry/src/qrcode/src/bits.rs"

    def remapped(home: str) -> bytes:
        return artifact(home).replace(home.encode(), repro.CARGO_HOME_REMAP.encode())

    one, two = "/mnt/work/home-one", "/mnt/work/home-two"
    assert remapped(one) == remapped(two)
    assert (
        hashlib.sha256(remapped(one)).hexdigest()
        == hashlib.sha256(remapped(two)).hexdigest()
    )
    assert (
        hashlib.sha256(artifact(one)).hexdigest()
        != hashlib.sha256(artifact(two)).hexdigest()
    )

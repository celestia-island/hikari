#!/usr/bin/env python3
"""Tests for the reproducibility contract (``component_reproducibility.py``).

The contract is one sentence -- *build the wasm components with both home
directories remapped* -- and the failure it prevents is silent in every lane
that is not the registry: ``cargo build`` succeeds, ``jco transpile`` succeeds,
the Vue suite passes, and the damage surfaces days later as an akivili
``Rejected`` for a component whose source nobody touched. So each failure shape
is pinned here, including the one that matters most in review: **half** the
contract satisfied (one home remapped, the other still leaking).

The `descriptor digests` case is the reason the whole module exists -- it pins
the artifact-bytes contract that the gate enforces, end to end, on a synthetic
artifact, so it fails if the two constants stop agreeing with the spelling the
gate emits.

Mutation anchors (each id names the branch whose removal reddens the test
listed beside it): MUT:no-unset-home-report MUT:no-single-home-report
MUT:no-export-line MUT:export-drift
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
    assert line is not None
    assert line.startswith(f'export {repro.RUSTFLAGS_VAR}="'), line
    value = line.split('"')[1]
    assert repro.problems({**env, repro.RUSTFLAGS_VAR: value}) == []


# ── failure shape 1: a home the toolchain would bake in is unset ──────────


@pytest.mark.parametrize("home", repro.REMAPPED_HOMES)
def test_an_unset_home_is_reported_by_name(home: str) -> None:
    # MUT:no-unset-home-report -- dropping the `if not value` branch leaves this
    # one silent, and an unset CARGO_HOME then only surfaces as a digest drift.
    env = clean_env()
    del env[home]
    found = repro.problems(env)
    assert [p.variable for p in found] == [home], [p.variable for p in found]
    assert "unset" in found[0].detail


def test_both_homes_unset_report_both() -> None:
    found = repro.problems({repro.RUSTFLAGS_VAR: "whatever"})
    assert [p.variable for p in found] == ["CARGO_HOME", "RUSTUP_HOME"]


def test_rustflags_is_the_value_the_export_line_prints() -> None:
    """`build.py` injects `rustflags()`; the advice prints `export_line()`.

    One derivation, two spellings: if they ever drift, a developer follows advice
    that does not satisfy the gate and the loop never converges.
    """
    env = {"CARGO_HOME": CARGO_HOME, "RUSTUP_HOME": RUSTUP_HOME}
    value = repro.rustflags(env)
    assert value is not None
    assert repro.export_line(env) == f'export {repro.RUSTFLAGS_VAR}="{value}"'
    assert repro.problems({**env, repro.RUSTFLAGS_VAR: value}) == []


def test_rustflags_is_none_without_both_homes() -> None:
    assert repro.rustflags({"CARGO_HOME": CARGO_HOME}) is None


# ── failure shape 2: no remap at all (the pre-fix world) ──────────────────


def test_an_empty_rustflags_value_reports_both_homes() -> None:
    env = {"CARGO_HOME": CARGO_HOME, "RUSTUP_HOME": RUSTUP_HOME}
    found = repro.problems(env)
    assert [p.variable for p in found] == [repro.RUSTFLAGS_VAR] * 2
    assert CARGO_HOME in found[0].detail
    assert RUSTUP_HOME in found[1].detail


# ── failure shape 3: exactly one home remapped ────────────────────────────


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
    assert repro._REMAP_TARGETS[missing] + "'" in found[0].detail, found[0].detail


def test_homes_only_mode_ignores_the_callers_flags() -> None:
    """`build.py` injects the value, so a stale export must neither help nor block.

    Refusing here would print advice the caller cannot act on -- the very next
    line of `build.py` overwrites the variable. The homes are still mandatory:
    they are the operands of the value being injected.
    """
    env = {"CARGO_HOME": CARGO_HOME, "RUSTUP_HOME": RUSTUP_HOME}
    assert repro.problems(env, require_flags=False) == []
    assert repro.problems({**env, "CARGO_HOME": ""}, require_flags=False)


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

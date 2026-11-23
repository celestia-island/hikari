#!/usr/bin/env python3
"""Tests for the npm-manifest guard (``packages/wasm/check_npm_pack.py``).

Why the guard exists: the bindings it protects are no longer committed, so the
tarball `npm pack` builds is the only thing that decides whether they travel
(see the PR's mutation table for the probe that narrowed the path list).

Two things are pinned here.

1. **The path list is the check.** ``REQUIRED_SUFFIXES`` decides what counts as
   "the directory travelled". A narrowed list silently turns the guard into a
   certificate: deleting just the ``.js`` entry made it report four healthy
   components for a tarball whose runtime entry modules were *all* absent
   (measured in review round 3). So the list is asserted directly, and the
   runtime entry is asserted to be in it — MUT:entry-module-required.
2. **Absent is refused, present is accepted**, per component, naming the exact
   path (``test_missing_entry_module_is_refused``, ``test_a_full_manifest_passes``).

The fixtures are path SETS, not files: the guard's input is the ``npm pack``
manifest, and what matters is which paths are in it.
"""
import importlib.util
import sys
from pathlib import Path

import pytest

HERE = Path(__file__).resolve().parent
_spec = importlib.util.spec_from_file_location("check_npm_pack", HERE / "check_npm_pack.py")
guard = importlib.util.module_from_spec(_spec)
assert _spec.loader is not None
sys.modules[_spec.name] = guard
_spec.loader.exec_module(guard)


def manifest_paths(component: str = "qr") -> set[str]:
    """The paths one built component contributes to a pack manifest."""
    return {
        f"src/wasm/{suffix.format(c=component)}"
        for suffix in guard.REQUIRED_SUFFIXES
    }


def full_manifest() -> set[str]:
    return {path for component in guard.COMPONENTS for path in manifest_paths(component)}


def test_the_runtime_entry_module_is_required() -> None:
    # MUT:entry-module-required -- dropping ENTRY_SUFFIX from REQUIRED_SUFFIXES
    # leaves a guard that accepts a tarball without a single shippable module.
    assert guard.ENTRY_SUFFIX in guard.REQUIRED_SUFFIXES, guard.REQUIRED_SUFFIXES


def test_every_component_requires_a_js_and_a_declaration() -> None:
    # Shape pin: one ``.js`` + at least one ``.d.ts`` per component. A list that
    # dropped either would still "pass" on a half-built tree.
    for component in guard.COMPONENTS:
        rendered = [suffix.format(c=component) for suffix in guard.REQUIRED_SUFFIXES]
        assert any(entry.endswith(".js") for entry in rendered), (component, rendered)
        assert any(entry.endswith(".d.ts") for entry in rendered), (component, rendered)


def test_a_full_manifest_passes(capsys: pytest.CaptureFixture[str]) -> None:
    assert guard.report(guard.COMPONENTS, full_manifest()) == 0
    assert f"{len(guard.COMPONENTS)} component(s) present" in capsys.readouterr().out


@pytest.mark.parametrize("component", guard.COMPONENTS)
def test_missing_entry_module_is_refused(component: str, capsys: pytest.CaptureFixture[str]) -> None:
    # The one file a consumer's import resolves to. Its absence must refuse and
    # must name the path — not the directory, which could still exist empty.
    paths = full_manifest() - {f"src/wasm/{guard.ENTRY_SUFFIX.format(c=component)}"}
    assert guard.report(guard.COMPONENTS, paths) == 1
    captured = capsys.readouterr()
    assert f"src/wasm/{guard.ENTRY_SUFFIX.format(c=component)}" in captured.err, captured.err
    assert "python3 packages/wasm/build.py" in captured.err, captured.err


def test_a_partially_built_tree_is_refused(capsys: pytest.CaptureFixture[str]) -> None:
    # The realistic failure: some components built, others not.
    paths = manifest_paths("qr") | manifest_paths("mermaid")
    assert guard.report(guard.COMPONENTS, paths) == 1
    err = capsys.readouterr().err
    assert "src/wasm/scene3d" in err and "src/wasm/highlight" in err, err
    assert "src/wasm/qr" not in err, err


def test_the_real_checkout_and_its_manifest_agree(tmp_path: Path) -> None:
    """The shipped tree really is in the manifest (skips when it was not built)."""
    root = HERE.parent.parent
    if any(not (root / "packages" / "vue" / "src" / "wasm" / c / f"hikari_wasm_{c}.js").is_file()
           for c in guard.COMPONENTS):
        pytest.skip("bindings absent: run python3 packages/wasm/build.py")
    assert guard.main(["--package-dir", str(root / "packages" / "vue")]) == 0

#!/usr/bin/env python3
"""Tests for the build lane's stale-artifact defence (``packages/wasm/build.py``).

The bindings this script writes are shipped, and the ``.wasm`` they are
transpiled from is a cargo artifact — which cargo leaves behind between runs.
"A file exists after ``cargo build`` succeeded" therefore proves nothing, and
the first version of this script treated it as proof. Measured in review round
3: a *different but valid* ``.wasm`` planted under the expected name was
transpiled verbatim into ``packages/vue/src/wasm/qr/`` while the build reported
success, cargo having recompiled nothing.

Two independent defences are pinned here:

* ``artifact_path`` — the name the crate's artifact takes. A rename here would
  make every build read ``None`` and fail; a rename in cargo's output would do
  the same, which is why the path is built in one place.
* ``build`` — the mtime/size comparison that refuses a build whose artifact did
  not change (``MUT:stale-artifact-check``).

``build()`` is driven with ``subprocess.run`` and ``ensure_artifact_fresh``
replaced, so no compiler is needed: the cases are about what the script does
with the filesystem state, not about cargo.
"""
import importlib.util
import sys
from pathlib import Path

import pytest

HERE = Path(__file__).resolve().parent
_spec = importlib.util.spec_from_file_location("hikari_build", HERE / "build.py")
build_lane = importlib.util.module_from_spec(_spec)
assert _spec.loader is not None
sys.modules[_spec.name] = build_lane
_spec.loader.exec_module(build_lane)


@pytest.fixture()
def lane(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """A fake target directory and a no-op spawn."""
    monkeypatch.setenv("CARGO_TARGET_DIR", str(tmp_path))
    return tmp_path


def artifact(lane: Path, comp: str = "qr") -> Path:
    path = build_lane.artifact_path(comp)
    path.parent.mkdir(parents=True, exist_ok=True)
    return path


def test_the_artifact_path_is_the_crate_name(lane: Path) -> None:
    # ``cargo build -p hikari-wasm-scene3d`` writes ``hikari_wasm_scene3d.wasm``.
    # Getting this wrong turns every build into "no wasm", so it is pinned.
    assert build_lane.artifact_path("scene3d") == (
        lane / "wasm32-wasip2" / "release" / "hikari_wasm_scene3d.wasm"
    )


def test_a_rebuilt_artifact_is_accepted(lane: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    path = artifact(lane)
    path.write_bytes(b"old")
    stale = build_lane.signature(path)

    def fake_run(*args, **kwargs):
        path.write_bytes(b"fresh")
        # Same size, different mtime: the comparison must not depend on size alone.
        assert build_lane.signature(path) != stale
        return None

    monkeypatch.setattr(build_lane.subprocess, "run", fake_run)
    monkeypatch.setattr(build_lane, "ensure_artifact_fresh", lambda _p: None)
    assert build_lane.build("qr") == path


def test_the_artifact_must_be_present_after_the_build(lane: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    # A build that claims success and leaves nothing behind is an error, not an
    # empty output directory for jco to fail on later (#MUT:artifact-present).
    path = artifact(lane)
    path.write_bytes(b"previous build")

    def run_then_delete(*args, **kwargs):
        assert not path.exists(), "the unlink must have run first"
        return None

    monkeypatch.setattr(build_lane.subprocess, "run", run_then_delete)
    with pytest.raises(SystemExit) as failure:
        build_lane.build("qr")
    assert "does not exist" in str(failure.value.code), failure.value.code


def test_the_signature_reports_absence_as_none(lane: Path) -> None:
    path = artifact(lane, "scene3d")
    assert build_lane.signature(path) is None
    path.write_bytes(b"x")
    assert build_lane.signature(path) == (path.stat().st_mtime_ns, 1)


def test_the_unlink_runs_before_the_build(lane: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    # The first defence: whatever was there cannot be read back, because the
    # build is the only thing that can produce the file again.
    path = artifact(lane)
    path.write_bytes(b"previous build")
    seen: list[str] = []

    def fake_run(*args, **kwargs):
        seen.append("gone" if not path.exists() else "present")
        path.write_bytes(b"this build")
        return None

    monkeypatch.setattr(build_lane.subprocess, "run", fake_run)
    assert build_lane.build("qr") == path
    assert seen == ["gone"], seen


def test_a_missing_cargo_names_the_install(lane: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    # A traceback is not an error message: the first line a developer sees must
    # say what is wrong and what to do about it.
    monkeypatch.setattr(build_lane, "ensure_artifact_fresh", lambda _p: None)

    def no_cargo(*args, **kwargs):
        raise FileNotFoundError(2, "No such file or directory", "cargo")

    monkeypatch.setattr(build_lane.subprocess, "run", no_cargo)
    with pytest.raises(SystemExit) as failure:
        build_lane.build("qr")
    message = str(failure.value.code)
    assert "cargo is not on PATH" in message and "rustup" in message, message


def test_a_failing_cargo_says_so_without_a_traceback(lane: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    import subprocess

    def failing(*args, **kwargs):
        raise subprocess.CalledProcessError(101, ["cargo", "build"])

    monkeypatch.setattr(build_lane.subprocess, "run", failing)
    monkeypatch.setattr(build_lane, "ensure_artifact_fresh", lambda _p: None)
    with pytest.raises(SystemExit) as failure:
        build_lane.build("qr")
    assert "exit 101" in str(failure.value.code), failure.value.code
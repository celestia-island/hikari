#!/usr/bin/env python3
"""Tests for the component-descriptor gate (``packages/wasm/component_descriptor.py``).

The gate exists because a descriptor (``packages/wasm/<c>/component.toml``) is a
valid akivili manifest for *any* WIT beside it: nothing in akivili can compare a
``requires-contract`` string to a world, a digest to an artifact, or a
capability to an import surface. Four failure shapes are pinned here, one test
each, exactly as phase 4's G4 names them:

1. **a one-character digest change** is refused, naming the component and both
   digests;
2. **a world that does not exist** in the WIT is refused, naming the expected
   contract (MUT:no-world-check);
3. **a contract version that does not match the WIT package** (``@0.2`` against
   ``0.1.0``) is refused, naming the expected contract (MUT:no-contract-check);
4. **a capability the WIT world never imports** is refused, naming the import
   surface (MUT:no-capability-check).

Plus two structural controls: the real four-component corpus must MATCH, and a
scan that matches **no** component must refuse rather than report green.

Fixtures are a miniature ``packages/wasm/<c>/wit/<c>.wit`` + ``component.toml``
layout mirroring hikari's real one, so every case is recomputable without the
artifacts. The corpus control runs against the real checkout.

Mutation anchors for the claim block above (each id names the gate branch whose
removal the listed test covers): MUT:no-world-check MUT:no-contract-check
MUT:no-capability-check MUT:no-digest-check MUT:build-command-guidance
MUT:no-cargo-target-dir
"""

from __future__ import annotations

import hashlib
import importlib.util
import subprocess
import sys
from pathlib import Path

import pytest

#: This file lives in ``packages/wasm/``; two levels up is the checkout root.
REPO = Path(__file__).resolve().parents[2]


@pytest.fixture(autouse=True)
def _isolate_cargo_target_dir(monkeypatch: pytest.MonkeyPatch) -> None:
    """Every case starts with NO ``CARGO_TARGET_DIR``.

    The gate now resolves its default artifact directory under
    ``CARGO_TARGET_DIR`` when that variable is set (``_default_artifact_dir``),
    which is what makes a task-lane build readable. Without this fixture the
    suite would inherit whatever the developer's shell exported and the
    "artifact absent" cases would silently find the real ones — their
    assertions would pass or fail depending on the ambient environment rather
    than on the code under test. The one case that WANTS the variable sets it
    itself, on top of this empty baseline.
    """
    monkeypatch.delenv("CARGO_TARGET_DIR", raising=False)

_gate_spec = importlib.util.spec_from_file_location(
    "component_descriptor", REPO / "packages" / "wasm" / "component_descriptor.py"
)
gate = importlib.util.module_from_spec(_gate_spec)
assert _gate_spec.loader is not None
# Register before executing: `dataclasses` resolves a class's annotations
# through `sys.modules[cls.__module__]`, which is None for an unregistered
# module and turns `@dataclass` into an AttributeError at import time.
sys.modules[_gate_spec.name] = gate
_gate_spec.loader.exec_module(gate)

#: The WIT of a pure-computation component: a world with no `import` at all.
PURE_WIT = """package celestia:hikari-{c}@0.1.0;

interface types {{
    record thing {{
        size: u8,
    }}
}}

world {c} {{
    use types.{{thing}};
    export encode: func() -> thing;
}}
"""

#: A world that DOES import, for the "the gate does not just demand empty" case.
#: MUT:no-capability-check -- with the import scan dropped, this fixture's
#: allowed set is empty and `log` is refused, reddening the test below.
IMPORTING_WIT = """package celestia:hikari-{c}@0.1.0;

interface types {{
    record thing {{
        size: u8,
    }}
}}

world {c} {{
    use types.{{thing}};
    import log: func(level: string, message: string);
    export encode: func() -> thing;
}}
"""

ARTIFACT = b"\0asm\x0d\x00\x01\x00stub wasm component"


def digest_of(data: bytes = ARTIFACT) -> str:
    return hashlib.sha256(data).hexdigest()


def descriptor(
    component: str,
    *,
    world: str | None = None,
    version: str = "0.1.0",
    contract_version: str = "0.1",
    capabilities: tuple[str, ...] = (),
    sha256: str | None = None,
) -> str:
    caps = ", ".join(f'"{c}"' for c in capabilities)
    body_world = world if world is not None else component
    return f"""schema = 1
id = "hikari-{component}"
version = "{version}"
provider = "celestia-island"
form = "wasm.component"
capabilities = [{caps}]
requires-contract = ["celestia:hikari-{component}/{body_world}@{contract_version}"]

[[resources]]
kind = "wasm.component"

[resources.payload.File]
path = "target/wasm32-wasip2/release/hikari_wasm_{component}.wasm"
sha256 = "{sha256 if sha256 is not None else digest_of()}"
"""


def make_repo(
    root: Path,
    component: str,
    *,
    wit: str | None = None,
    manifest: str | None = None,
    artifacts: Path | None = None,
) -> Path:
    """A one-component checkout, plus its artifact when one is asked for."""
    wit_dir = root / "packages" / "wasm" / component / "wit"
    wit_dir.mkdir(parents=True)
    (wit_dir / f"{component}.wit").write_text(
        wit if wit is not None else PURE_WIT.format(c=component), encoding="utf-8"
    )
    if manifest is not False:
        (wit_dir.parent / "component.toml").write_text(
            manifest if manifest is not None else descriptor(component), encoding="utf-8"
        )
    if artifacts is not None:
        artifacts.mkdir(parents=True, exist_ok=True)
        (artifacts / f"hikari_wasm_{component}.wasm").write_bytes(ARTIFACT)
    return root


# ── the known positive ───────────────────────────────────────────────────


def test_a_matching_descriptor_passes(tmp_path: Path) -> None:
    repo = make_repo(tmp_path / "repo", "qr", artifacts=tmp_path / "art")
    verdicts = [gate.check_component(repo, w, tmp_path / "art") for w in gate.discover(repo)]
    assert len(verdicts) == 1
    assert verdicts[0].ok, verdicts[0].findings
    assert not verdicts[0].unreached


def test_the_expected_contract_is_the_two_part_projection() -> None:
    world = gate.World(
        component="qr",
        package_id="celestia:hikari-qr",
        version="0.1.0",
        world="qr",
    )
    assert world.expected_contract == "celestia:hikari-qr/qr@0.1"


# ── negative control 1: one digest character ─────────────────────────────


def test_a_one_character_digest_change_is_refused(tmp_path: Path) -> None:
    good = digest_of()
    flipped = good[:-1] + ("0" if good[-1] != "0" else "1")
    assert flipped != good
    repo = make_repo(
        tmp_path / "repo", "qr", manifest=descriptor("qr", sha256=flipped), artifacts=tmp_path / "a"
    )
    verdicts = [gate.check_component(repo, w, tmp_path / "a") for w in gate.discover(repo)]
    assert not verdicts[0].ok
    joined = " ".join(verdicts[0].findings)
    assert "sha256 mismatch" in joined, joined
    assert flipped in joined and good in joined, joined


# ── negative control 2: a world that does not exist (MUT:no-world-check) ──


def test_a_world_that_does_not_exist_is_refused(tmp_path: Path) -> None:
    repo = make_repo(
        tmp_path / "repo",
        "qr",
        manifest=descriptor("qr", world="encode"),
        artifacts=tmp_path / "a",
    )
    verdicts = [gate.check_component(repo, w, tmp_path / "a") for w in gate.discover(repo)]
    assert not verdicts[0].ok
    joined = " ".join(verdicts[0].findings)
    assert "celestia:hikari-qr/encode@0.1" in joined, joined
    assert "expected 'celestia:hikari-qr/qr@0.1'" in joined, joined


# ── negative control 3: a version the WIT does not have (MUT:no-contract-check) ──


def test_a_contract_version_that_does_not_match_the_wit_is_refused(tmp_path: Path) -> None:
    repo = make_repo(
        tmp_path / "repo",
        "qr",
        manifest=descriptor("qr", contract_version="0.2"),
        artifacts=tmp_path / "a",
    )
    verdicts = [gate.check_component(repo, w, tmp_path / "a") for w in gate.discover(repo)]
    assert not verdicts[0].ok
    joined = " ".join(verdicts[0].findings)
    assert "celestia:hikari-qr/qr@0.2" in joined, joined
    # Both halves of the contract check must speak: the mismatch line names the
    # declared ref, and the membership line names the expected one. Asserting
    # only `@0.1` would let the membership branch alone carry the test (the
    # mismatch line also contains it), leaving that branch unpinned -- MUT:no-contract-check
    # survived exactly that way before this line existed.
    assert "does not match the WIT world -- expected 'celestia:hikari-qr/qr@0.1'" in joined, joined
    assert "does not include 'celestia:hikari-qr/qr@0.1'" in joined, joined


def test_a_descriptor_version_that_does_not_match_the_wit_package_is_refused(
    tmp_path: Path,
) -> None:
    repo = make_repo(
        tmp_path / "repo",
        "qr",
        manifest=descriptor("qr", version="0.2.0"),
        artifacts=tmp_path / "a",
    )
    verdicts = [gate.check_component(repo, w, tmp_path / "a") for w in gate.discover(repo)]
    assert not verdicts[0].ok
    assert "does not match the WIT package version" in " ".join(verdicts[0].findings)


# ── negative control 4: a capability the WIT never imports (MUT:no-capability-check) ──


def test_a_capability_the_wit_never_imports_is_refused(tmp_path: Path) -> None:
    repo = make_repo(
        tmp_path / "repo",
        "qr",
        manifest=descriptor("qr", capabilities=("kv.read",)),
        artifacts=tmp_path / "a",
    )
    verdicts = [gate.check_component(repo, w, tmp_path / "a") for w in gate.discover(repo)]
    assert not verdicts[0].ok
    joined = " ".join(verdicts[0].findings)
    assert "'kv.read'" in joined, joined
    assert "import surface" in joined, joined


def test_a_capability_the_wit_does_import_is_accepted(tmp_path: Path) -> None:
    # The gate records imports rather than demanding an empty set forever: the
    # day a world gains an import, declaring it stays legal.
    repo = make_repo(
        tmp_path / "repo",
        "qr",
        wit=IMPORTING_WIT.format(c="qr"),
        manifest=descriptor("qr", capabilities=("log",)),
        artifacts=tmp_path / "a",
    )
    worlds = gate.discover(repo)
    assert worlds[0].imports == ["log"], worlds[0].imports
    verdicts = [gate.check_component(repo, w, tmp_path / "a") for w in worlds]
    assert verdicts[0].ok, verdicts[0].findings


# ── structural controls ──────────────────────────────────────────────────


def test_a_commented_out_contract_cannot_supply_the_version(tmp_path: Path) -> None:
    wit = (
        "// package celestia:hikari-qr@9.9.9;\n"
        + PURE_WIT.format(c="qr")
    )
    repo = make_repo(tmp_path / "repo", "qr", wit=wit, artifacts=tmp_path / "a")
    worlds = gate.discover(repo)
    assert worlds[0].version == "0.1.0", worlds[0].version


def test_a_missing_descriptor_is_refused(tmp_path: Path) -> None:
    repo = make_repo(tmp_path / "repo", "qr", manifest=False, artifacts=tmp_path / "a")
    verdicts = [gate.check_component(repo, w, tmp_path / "a") for w in gate.discover(repo)]
    assert not verdicts[0].ok
    assert "no component.toml" in " ".join(verdicts[0].findings)


def test_an_unversioned_wit_is_refused_loudly(tmp_path: Path) -> None:
    repo = tmp_path / "repo"
    wit_dir = repo / "packages" / "wasm" / "qr" / "wit"
    wit_dir.mkdir(parents=True)
    (wit_dir / "qr.wit").write_text("package celestia:hikari-qr;\n\nworld qr {}\n", encoding="utf-8")
    with pytest.raises(SystemExit) as excinfo:
        gate.discover(repo)
    assert "carries no version" in str(excinfo.value)


def test_an_empty_scan_fails_instead_of_reporting_green(tmp_path: Path) -> None:
    # Zero components means the glob stopped matching -- a green verdict there
    # would mean nothing, so the CLI refuses.
    empty = tmp_path / "empty"
    empty.mkdir()
    result = subprocess.run(
        [sys.executable, str(REPO / "packages" / "wasm" / "component_descriptor.py"), "--repo", str(empty)],
        capture_output=True,
        text=True,
    )
    assert result.returncode == 1, result.stdout + result.stderr
    assert "matched nothing" in result.stderr


def test_an_unreached_artifact_is_reported_not_silently_passed(tmp_path: Path) -> None:
    repo = make_repo(tmp_path / "repo", "qr")  # no artifact directory at all
    verdicts = [gate.check_component(repo, w, None) for w in gate.discover(repo)]
    assert verdicts[0].ok, "an absent artifact must not turn into a finding"
    assert verdicts[0].unreached, "an absent artifact must be REPORTED"


def _run_cli(repo: Path, *extra: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, str(REPO / "packages" / "wasm" / "component_descriptor.py"),
         "--repo", str(repo), *extra],
        capture_output=True,
        text=True,
    )


def test_an_absent_artifact_exits_non_zero(tmp_path: Path) -> None:
    # The whole point of the digest: "no artifact" must not be indistinguishable
    # from "artifact matches". Printing UNREACHED to stderr while exiting 0 was
    # exactly that confusion (MUT:unverified-exit-zero).
    repo = make_repo(tmp_path / "repo", "qr")
    result = _run_cli(repo)
    assert result.returncode == gate.EXIT_UNVERIFIED, result.stdout + result.stderr
    assert "could not be verified" in result.stderr


def test_allow_unverified_opts_out_explicitly(tmp_path: Path) -> None:
    repo = make_repo(tmp_path / "repo", "qr")
    result = _run_cli(repo, "--allow-unverified")
    assert result.returncode == gate.EXIT_OK, result.stdout + result.stderr
    assert "could not be verified" in result.stderr, "the opt-out must still announce"


def test_an_absent_artifact_names_the_build_command(tmp_path: Path) -> None:
    # Retiring the checked-in jco bindings made "the tree has no artifacts" the
    # FIRST state a fresh clone is in, so the message has to be actionable on
    # its own. "build it, then re-run with --artifacts <dir>" was not: it named
    # neither the supported command nor the fact that the command honours
    # CARGO_TARGET_DIR, which is where a task-lane build actually leaves the
    # file. MUT:build-command-guidance -- dropping BUILD_COMMAND from the
    # unreached message leaves the build lane with no next step.
    repo = make_repo(tmp_path / "repo", "qr")
    result = _run_cli(repo)
    assert gate.BUILD_COMMAND in result.stderr, result.stderr


def test_a_configured_cargo_target_dir_is_where_the_artifacts_are(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    # The descriptors declare a repo-relative path, which is where an
    # unconfigured `cargo build` writes -- NOT where the workspace convention
    # (a task-local CARGO_TARGET_DIR) writes. Before this resolution the gate
    # reported "digest unverified" for an artifact the caller had just built
    # into that directory, and passing --artifacts by hand was the only way
    # through. MUT:no-cargo-target-dir -- with `_default_artifact_dir`
    # returning None unconditionally, this case exits EXIT_UNVERIFIED.
    repo = make_repo(tmp_path / "repo", "qr")
    lane = tmp_path / "lane"
    (lane / "wasm32-wasip2" / "release").mkdir(parents=True)
    (lane / "wasm32-wasip2" / "release" / "hikari_wasm_qr.wasm").write_bytes(ARTIFACT)
    monkeypatch.setenv("CARGO_TARGET_DIR", str(lane))
    result = _run_cli(repo)
    assert result.returncode == gate.EXIT_OK, result.stdout + result.stderr
    assert "digests verified" in result.stdout, result.stdout


def test_an_explicit_artifacts_dir_still_wins_over_cargo_target_dir(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    # The new default must not quietly override the operator's own choice: a
    # lane directory that does not hold the artifact must still be reported
    # absent rather than replaced by CARGO_TARGET_DIR's copy.
    repo = make_repo(tmp_path / "repo", "qr")
    lane = tmp_path / "lane"
    (lane / "wasm32-wasip2" / "release").mkdir(parents=True)
    (lane / "wasm32-wasip2" / "release" / "hikari_wasm_qr.wasm").write_bytes(ARTIFACT)
    monkeypatch.setenv("CARGO_TARGET_DIR", str(lane))
    empty = tmp_path / "empty"
    empty.mkdir()
    result = _run_cli(repo, "--artifacts", str(empty))
    assert result.returncode == gate.EXIT_UNVERIFIED, result.stdout + result.stderr


def test_a_verified_artifact_exits_zero(tmp_path: Path) -> None:
    repo = make_repo(tmp_path / "repo", "qr", artifacts=tmp_path / "a")
    result = _run_cli(repo, "--artifacts", str(tmp_path / "a"))
    assert result.returncode == gate.EXIT_OK, result.stdout + result.stderr


def test_a_non_table_resource_entry_is_a_finding_not_a_crash(tmp_path: Path) -> None:
    # TOML accepts `resources = ["x.wasm"]`; an unguarded `.get` on that raised
    # AttributeError and the process died with a traceback instead of naming
    # the field (MUT:no-resource-table-guard).
    manifest = descriptor("qr").split("[[resources]]")[0] + (
        'resources = ["target/wasm32-wasip2/release/hikari_wasm_qr.wasm"]\n'
    )
    repo = make_repo(tmp_path / "repo", "qr", manifest=manifest, artifacts=tmp_path / "a")
    verdicts = [gate.check_component(repo, w, tmp_path / "a") for w in gate.discover(repo)]
    assert not verdicts[0].ok
    assert "not a table" in " ".join(verdicts[0].findings)
    result = _run_cli(repo, "--artifacts", str(tmp_path / "a"))
    assert result.returncode == gate.EXIT_FINDINGS, result.stdout + result.stderr
    assert "Traceback" not in result.stderr


def test_a_resource_kind_that_disagrees_with_the_form_is_refused(tmp_path: Path) -> None:
    # `kind` is what akivili files the payload under. A descriptor whose form
    # says wasm.component while the resource says anything else is internally
    # inconsistent (MUT:no-kind-check).
    manifest = descriptor("qr").replace('kind = "wasm.component"', 'kind = "action"')
    repo = make_repo(tmp_path / "repo", "qr", manifest=manifest, artifacts=tmp_path / "a")
    verdicts = [gate.check_component(repo, w, tmp_path / "a") for w in gate.discover(repo)]
    assert not verdicts[0].ok, "a kind/form disagreement must be refused"
    assert "kind is 'action'" in " ".join(verdicts[0].findings)


# ── both directions of the capability surface (MUT:no-ungranted-import-check) ──


def test_an_import_the_descriptor_does_not_grant_is_refused(tmp_path: Path) -> None:
    # A world that gains an import while the descriptor keeps capabilities = []
    # used to pass: the subset check only asked "is every declared capability
    # imported", never "is every import granted".
    repo = make_repo(
        tmp_path / "repo",
        "qr",
        wit=IMPORTING_WIT.format(c="qr"),
        manifest=descriptor("qr", capabilities=()),
        artifacts=tmp_path / "a",
    )
    verdicts = [gate.check_component(repo, w, tmp_path / "a") for w in gate.discover(repo)]
    assert not verdicts[0].ok, "an ungranted import must be refused"
    joined = " ".join(verdicts[0].findings)
    assert "imports 'log' but the descriptor grants no matching capability" in joined, joined


def test_a_second_world_with_imports_is_reported(tmp_path: Path) -> None:
    # A `.wit` may declare several worlds; examining only the first left the
    # rest unexamined (MUT:first-world-only).
    wit = PURE_WIT.format(c="qr") + """
world encode {
    import wasi:cli/environment@0.2.12;
    export run: func() -> u32;
}
"""
    repo = make_repo(tmp_path / "repo", "qr", wit=wit, artifacts=tmp_path / "a")
    worlds = gate.discover(repo)
    assert [name for name, _ in worlds[0].extra_worlds] == ["encode"]
    verdicts = [gate.check_component(repo, w, tmp_path / "a") for w in worlds]
    assert not verdicts[0].ok, "a second world's import surface must be reported"
    assert "world 'encode'" in " ".join(verdicts[0].findings)


def test_a_second_world_without_imports_is_harmless(tmp_path: Path) -> None:
    wit = PURE_WIT.format(c="qr") + "\nworld encode {\n    export run: func() -> u32;\n}\n"
    repo = make_repo(tmp_path / "repo", "qr", wit=wit, artifacts=tmp_path / "a")
    verdicts = [gate.check_component(repo, w, tmp_path / "a") for w in gate.discover(repo)]
    assert verdicts[0].ok, verdicts[0].findings


# ── the real corpus ──────────────────────────────────────────────────────


REAL_ARTIFACTS = Path("/mnt/work/target-akivili-desc/wasm32-wasip2/release")


def test_the_real_four_component_corpus_matches() -> None:
    worlds = gate.discover(REPO)
    assert len(worlds) == 4, [w.component for w in worlds]
    assert sorted(w.component for w in worlds) == ["highlight", "mermaid", "qr", "scene3d"]
    artifacts = REAL_ARTIFACTS if (REAL_ARTIFACTS / "hikari_wasm_qr.wasm").is_file() else None
    verdicts = [gate.check_component(REPO, w, artifacts) for w in worlds]
    failed = [v for v in verdicts if not v.ok]
    assert not failed, [v.findings for v in failed]
    if artifacts is None:
        pytest.skip("built artifacts absent: run cargo build --target wasm32-wasip2 first")
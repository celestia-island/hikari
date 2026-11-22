#!/usr/bin/env python3
"""component-descriptor - the hikari wasm descriptors must match their contracts.

*Why this exists:* phase 4 of the tairitsu/hikari browser wave puts the four
hikari wasm components into the akivili registry. A descriptor
(``packages/wasm/<c>/component.toml``) is an ``akivili.plugin.toml`` manifest,
and akivili's scanner validates its *shape* -- but a shape check cannot know
which WIT world this component actually implements, at which version, or which
host imports it really declares. Four things can therefore go wrong while every
individual file stays valid:

1. The descriptor pins ``celestia:hikari-qr/encode@0.1`` but the world is named
   ``qr`` -- the registry would claim a world nothing implements.
2. The WIT bumps to ``@0.2.0`` and the descriptor keeps ``@0.1`` -- consumers
   pin a contract the component no longer speaks.
3. The artifact is rebuilt and ``sha256`` keeps the old digest -- the registry
   accepts a payload whose bytes are not the reviewed ones.
4. The descriptor declares a capability the component never imports -- a
   widened grant that no WIT import justifies.

Each of those is caught here, and each names the offending component and field
in its message so the fix is mechanical.

*What it reads, and what it deliberately does NOT:*

* ``requires-contract`` is derived: WIT ``package celestia:hikari-<c>@X.Y.Z``
  plus the world declared in the same file gives ``celestia:hikari-<c>/<world>@X.Y``
  -- the two-part version is akivili's ``ContractRef`` form, the same
  ``major.minor`` projection ``addressing`` documents.
* ``capabilities`` is checked against the WIT world's **import** surface. All
  four components are pure computation: their worlds have no ``import`` at all,
  so the expected set is empty and any declared capability is a widening. The
  parser behaves the other way round on purpose -- it *records* imports, so the
  day a world gains one the gate keeps working instead of silently demanding
  "empty forever".
* The digest is checked against a real artifact when one is reachable, and
  reported as *unreached* when it is not. An unreached artifact is not a pass:
  the gate prints it loudly. The repository does not carry the ``.wasm`` bytes
  (``target/`` is ignored; the Vue package ships jco-transpiled JS), so the
  digest is verified in the lane that built the artifact:
  ``cargo build --target wasm32-wasip2`` then this script with
  ``--artifacts <dir>``.

*Scope:* components are discovered from ``packages/wasm/*/wit/*.wit``, the same
way the artifact-drift gate does it -- a new component joins by existing.
"""

from __future__ import annotations

import argparse
import hashlib
import re
import sys
import tomllib
from dataclasses import dataclass, field
from pathlib import Path

EXIT_OK = 0
EXIT_FINDINGS = 1
EXIT_USAGE = 2

WIT_GLOB = "packages/wasm/*/wit/*.wit"
DESCRIPTOR_NAME = "component.toml"
HERE = Path(__file__).resolve().parent

#: Where ``cargo build --target wasm32-wasip2 --release`` puts a component by
#: default; the build lane can point ``--artifacts`` elsewhere.
DEFAULT_ARTIFACT_DIR = "target/wasm32-wasip2/release"

#: ``package celestia:hikari-qr@0.1.0;`` -- the id and version the descriptors
#: must agree with. The namespace and component stem are not hardcoded past
#: this point: a component that renames itself is rebuilt from its own file.
_PACKAGE = re.compile(
    r"^package\s+(?P<id>[A-Za-z0-9][A-Za-z0-9._:-]*)(?:@(?P<version>[0-9][A-Za-z0-9.\-]*))?\s*;",
    re.MULTILINE,
)
#: ``world qr { ... }`` -- the world the descriptor's ``requires-contract``
#: second segment names. WIT allows a world to be declared with the same
#: braces-on-file-end shape as an interface, so the body is scanned to its match.
_WORLD = re.compile(r"^world\s+(?P<name>[a-z][a-z0-9-]*)\s*\{", re.MULTILINE)
#: ``import log: func(...)`` / ``import wasi:cli/exit@0.2.12;`` -- both the
#: inline-function form and the named-interface form count as an import surface.
_IMPORT = re.compile(r"^\s*import\s+(?P<what>[A-Za-z0-9][A-Za-z0-9._:\-/@]*)\s*[:;]", re.MULTILINE)

_BLOCK_COMMENT = re.compile(r"/\*.*?\*/", re.DOTALL)
_LINE_COMMENT = re.compile(r"//[^\n]*")

_HEX64 = re.compile(r"^[0-9a-f]{64}$")


@dataclass
class World:
    """What one WIT file says about itself."""

    component: str
    package_id: str
    version: str
    world: str | None = None
    imports: list[str] = field(default_factory=list)

    @property
    def expected_contract(self) -> str | None:
        """``celestia:<domain>/<world>@<major>.<minor>``, akivili's ref form."""
        if self.world is None or not self.version:
            return None
        parts = self.version.split(".")
        if len(parts) < 2 or not all(p.isdigit() for p in parts[:2]):
            return None
        # The two-part projection: `0.1.0` -> `0.1`. akivili's ContractRef is a
        # compatibility constraint over the package semver, not a restatement.
        return f"{self.package_id}/{self.world}@{parts[0]}.{parts[1]}"


def _strip_comments(text: str) -> str:
    """Remove block then line comments so a commented-out contract cannot win."""
    return _LINE_COMMENT.sub("", _BLOCK_COMMENT.sub("", text))


def _world_body(text: str, start: int) -> str:
    """The body of the `{ ... }` block beginning at ``start``.

    Brace counting, because a WIT world body may contain records with their own
    nested braces and a lazy regex would stop at the first one.
    """
    depth = 0
    for index in range(start, len(text)):
        char = text[index]
        if char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                return text[start + 1 : index]
    return text[start + 1 :]


def parse_wit(path: Path, component: str) -> World:
    """Parse one WIT file into the facts the descriptor must agree with."""
    raw = path.read_text(encoding="utf-8")
    text = _strip_comments(raw)

    package = _PACKAGE.search(text)
    if package is None:
        raise SystemExit(
            f"{path}: no `package <id>@<version>;` declaration -- WIT has no "
            "package id, so no descriptor can pin a contract to it"
        )
    package_id = package.group("id")
    version = package.group("version") or ""
    if not version:
        raise SystemExit(
            f"{path}: package `{package_id}` carries no version -- akivili's "
            "ContractRef needs `@<major>.<minor>` and an unversioned WIT has none"
        )

    imports: list[str] = []
    world_name: str | None = None
    world_match = _WORLD.search(text)
    if world_match is not None:
        world_name = world_match.group("name")
        body = _world_body(text, world_match.end() - 1)
        imports = [m.group("what") for m in _IMPORT.finditer(body)]
    return World(
        component=component,
        package_id=package_id,
        version=version,
        world=world_name,
        imports=imports,
    )


def discover(repo: Path) -> list[World]:
    """Every component under ``packages/wasm/*/wit/*.wit``, in name order."""
    worlds: list[World] = []
    for wit in sorted(repo.glob(WIT_GLOB)):
        worlds.append(parse_wit(wit, wit.parent.parent.name))
    return worlds


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


@dataclass
class Verdict:
    """The outcome of checking one component."""

    component: str
    findings: list[str] = field(default_factory=list)
    unreached: list[str] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return not self.findings


def check_component(
    repo: Path, world: World, artifacts: Path | None = None
) -> Verdict:
    """Check one component's descriptor against its WIT and its artifact.

    Returns a :class:`Verdict`; ``findings`` names the offending field and
    component, ``unreached`` records artifacts the digest could not be proven
    against (reported, never silently passed).
    """
    verdict = Verdict(component=world.component)
    descriptor_path = repo / "packages" / "wasm" / world.component / DESCRIPTOR_NAME

    if not descriptor_path.exists():
        verdict.findings.append(
            f"{world.component}: no {DESCRIPTOR_NAME} -- the component declares a "
            f"WIT world but no descriptor pins it"
        )
        return verdict

    try:
        descriptor = tomllib.loads(descriptor_path.read_text(encoding="utf-8"))
    except tomllib.TOMLDecodeError as error:
        verdict.findings.append(f"{world.component}: {DESCRIPTOR_NAME} is not TOML: {error}")
        return verdict

    # ── version: the descriptor version is the WIT package version ────────
    declared_version = descriptor.get("version")
    if declared_version != world.version:
        verdict.findings.append(
            f"{world.component}: version {declared_version!r} does not match the WIT "
            f"package version {world.version!r} -- bump both together"
        )

    # ── world + contract version ride `requires-contract` ────────────────
    expected = world.expected_contract
    if expected is None:
        verdict.findings.append(
            f"{world.component}: the WIT file declares no world, so no contract "
            f"reference can be derived (package {world.package_id}@{world.version})"
        )
    else:
        contracts = descriptor.get("requires-contract") or []
        if not isinstance(contracts, list):
            verdict.findings.append(
                f"{world.component}: requires-contract must be an array of contract "
                f"references, got {type(contracts).__name__}"
            )
        else:
            for declared in contracts:
                if declared != expected:
                    verdict.findings.append(
                        f"{world.component}: requires-contract {declared!r} does not "
                        f"match the WIT world -- expected {expected!r}"
                    )
            if expected not in contracts:
                verdict.findings.append(
                    f"{world.component}: requires-contract does not include {expected!r} "
                    f"-> the registry would not link this descriptor to its world"
                )

    # ── capabilities must not exceed the WIT import surface ──────────────
    declared_caps = descriptor.get("capabilities") or []
    if not isinstance(declared_caps, list):
        verdict.findings.append(
            f"{world.component}: capabilities must be an array, got "
            f"{type(declared_caps).__name__}"
        )
    else:
        # Pure-computation components import nothing; the expected grant is the
        # empty set. A world that gains an import keeps this gate honest: the
        # descriptor may then declare it, and anything else is still a widening.
        allowed = set(world.imports)
        for capability in declared_caps:
            if capability not in allowed:
                verdict.findings.append(
                    f"{world.component}: capability {capability!r} is not in the WIT "
                    f"world '{world.world}' import surface "
                    f"({sorted(allowed) if allowed else 'no imports'}) -- declared "
                    f"wider than the contract grants"
                )

    # ── the payload digest must be the artifact's real digest ────────────
    resources = descriptor.get("resources") or []
    if not resources:
        verdict.findings.append(
            f"{world.component}: no [[resources]] -- a wasm.component descriptor "
            f"must ship its payload"
        )
    for index, entry in enumerate(resources):
        payload = (entry or {}).get("payload") or {}
        file_entry = payload.get("File") if isinstance(payload, dict) else None
        if not isinstance(file_entry, dict):
            verdict.findings.append(
                f"{world.component}: resources[{index}] has no File payload -- the "
                f"artifact path and digest are what the registry checks"
            )
            continue
        digest = file_entry.get("sha256")
        if not isinstance(digest, str) or not _HEX64.match(digest):
            verdict.findings.append(
                f"{world.component}: resources[{index}].payload.File.sha256 "
                f"{digest!r} is not a 64-character lowercase hex digest"
            )

        # Where the artifact actually is: an explicit lane directory wins,
        # otherwise the path the descriptor itself declares (repo-relative).
        declared_path = file_entry.get("path")
        candidate: Path | None = None
        if artifacts is not None:
            candidate = artifacts / Path(str(declared_path)).name
        elif isinstance(declared_path, str):
            candidate = repo / declared_path
        if candidate is None or not candidate.is_file():
            verdict.unreached.append(
                f"{world.component}: artifact for {declared_path!r} not found at "
                f"{candidate} -- digest unverified (build it, then re-run with "
                f"--artifacts <dir>)"
            )
            continue
        actual = _sha256(candidate)
        if isinstance(digest, str) and actual != digest:
            verdict.findings.append(
                f"{world.component}: sha256 mismatch for {declared_path!r}: declared "
                f"{digest}, actual {actual} -- the artifact bytes are not the ones "
                f"this descriptor pins"
            )
    return verdict


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Check hikari wasm descriptors against their WIT contracts and artifacts."
    )
    parser.add_argument(
        "--repo",
        default=str(HERE.parent.parent),
        help="hikari checkout root (default: two levels above this script)",
    )
    parser.add_argument(
        "--artifacts",
        default=None,
        help=f"directory holding the built .wasm files (default: the descriptor's "
        f"own path, i.e. {DEFAULT_ARTIFACT_DIR}/)",
    )
    parser.add_argument("--quiet", action="store_true", help="only print failures")
    args = parser.parse_args(argv)

    repo = Path(args.repo).resolve()
    if not repo.is_dir():
        print(f"component-descriptor: --repo is not a directory: {repo}", file=sys.stderr)
        return EXIT_USAGE
    artifacts = Path(args.artifacts).resolve() if args.artifacts else None

    worlds = discover(repo)
    if not worlds:
        # Zero components is a broken scan, not a clean repo: the glob is the
        # only thing that decides scope, so an empty result means it stopped
        # matching (`packages/wasm/*/wit/*.wit`).
        print(
            f"component-descriptor: FAIL no component found under {repo}/{WIT_GLOB} -- "
            f"the scan matched nothing, so a green verdict would mean nothing",
            file=sys.stderr,
        )
        return EXIT_FINDINGS

    verdicts = [check_component(repo, world, artifacts) for world in worlds]
    failed = [v for v in verdicts if not v.ok]

    for verdict in verdicts:
        for note in verdict.unreached:
            print(f"UNREACHED {note}", file=sys.stderr)
        for finding in verdict.findings:
            print(f"FAIL {finding}", file=sys.stderr)
    if not args.quiet:
        for verdict in verdicts:
            state = "MATCH" if verdict.ok else "MISMATCH"
            print(f"{state} {verdict.component}")

    if failed:
        print(
            f"component-descriptor: {len(failed)} of {len(verdicts)} component(s) "
            f"disagree with their contract",
            file=sys.stderr,
        )
        return EXIT_FINDINGS
    unreached_count = sum(len(v.unreached) for v in verdicts)
    if unreached_count:
        print(
            f"component-descriptor: OK {len(verdicts)} descriptor(s); "
            f"{unreached_count} digest(s) unverified (artifacts not present)",
            file=sys.stderr,
        )
    elif not args.quiet:
        print(f"component-descriptor: OK {len(verdicts)} descriptor(s), digests verified")
    return EXIT_OK


if __name__ == "__main__":
    sys.exit(main())
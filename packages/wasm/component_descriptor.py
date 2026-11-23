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
  ``major.minor`` projection ``addressing`` documents. **This gate compares
  strings; it does not claim the registry acts on them.** akivili validates a
  ``ContractRef``'s shape and stores it, but currently reads
  ``requires_contract`` nowhere outside its own tests -- so a wrong value is a
  contract defect a consumer would hit, not something the registry rejects.
* ``capabilities`` is checked in **both** directions against the WIT world's
  **import** surface: declaring more than the WIT imports is a widened grant,
  and leaving a WIT import ungranted is the same defect from the other side.
  All four components are pure computation today (their worlds have no
  ``import`` at all), and the two-way check is what keeps that true the day a
  world gains one -- a one-way subset check would pass an ungranted import
  silently. A file declaring a second world is reported rather than ignored.
* The digest is checked against a real artifact when one is reachable. When it
  is not, the gate **exits non-zero** (``EXIT_UNVERIFIED``) instead of reporting
  success: an absent artifact must never look like a matching one. The
  repository does not carry the ``.wasm`` bytes (``target/`` is ignored; the Vue
  package ships jco-transpiled JS), so the digest is verified in the lane that
  built the artifact: ``cargo build --target wasm32-wasip2`` then this script
  with ``--artifacts <dir>``. ``--allow-unverified`` is the explicit opt-in for
  a checkout that genuinely has no artifacts.

*Scope:* components are discovered from ``packages/wasm/*/wit/*.wit`` -- a new
component joins by existing. That glob is deliberately WIT-shaped and not
``*/Cargo.toml`` (how ``build.py`` finds crates to compile): a crate with no
``wit/`` directory has no contract, so no descriptor can pin it and the gate
has nothing to check. A ``Cargo.toml``-shaped scan would report a buildable
component whose contract does not exist.
"""

from __future__ import annotations

import argparse
import hashlib
import os
import re
import sys
import tomllib
from dataclasses import dataclass, field
from pathlib import Path

EXIT_OK = 0
EXIT_FINDINGS = 1
EXIT_USAGE = 2
#: A descriptor matched its WIT but its digest could not be proven: distinct
#: from both "clean" and "wrong", so a caller cannot mistake absence for a pass.
EXIT_UNVERIFIED = 3

WIT_GLOB = "packages/wasm/*/wit/*.wit"
DESCRIPTOR_NAME = "component.toml"
#: The plugin form every hikari descriptor declares, and the resource kind its
#: payload must carry (akivili filters hosts on this tag).
FORM = "wasm.component"
HERE = Path(__file__).resolve().parent

#: Where ``cargo build --target wasm32-wasip2 --release`` puts a component by
#: default; the build lane can point ``--artifacts`` elsewhere.
DEFAULT_ARTIFACT_DIR = "target/wasm32-wasip2/release"

#: The one command that produces every input this gate reads (the ``.wasm``
#: artifacts, and — for the callers that then type-check or test the Vue layer
#: — the jco bindings beside them). Named in every "absent" message: those
#: messages used to stop at "build it", which assumes the reader already knows
#: which of several cargo invocations is the supported one.
BUILD_COMMAND = "python3 packages/wasm/build.py"

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
#: The WIT forms an import can take inside a world body:
#:
#: * ``import log: func(level: string);`` -- an inline function.
#: * ``import wasi:cli/environment@0.2.12;`` -- a named interface.
#: * ``import foo: interface { … }`` -- an inline interface, whose body ends in
#:   a brace rather than `:` or `;`.
#: * ``import wasi:cli/environment@0.2.12 with { … }`` -- a named interface
#:   with an `include`-style record merge.
#:
#: The first two are what this corpus uses today; all four are matched so the
#: "records imports" claim stays true when a world starts using the others.
_IMPORT = re.compile(
    r"^\s*import\s+(?P<what>[A-Za-z0-9][A-Za-z0-9._:\-/@]*)"
    r"(?:\s*:\s*(?:func|interface|static|resource)\b|\s*;|\s+with\s*\{)",
    re.MULTILINE,
)


def _imports_in(body: str) -> list[str]:
    """The import surface of one world body, in declaration order."""
    return [m.group("what") for m in _IMPORT.finditer(body)]

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
    #: Every world the file declares, `(name, imports)`. The first one is also
    #: `world`/`imports` above; the rest exist so a SECOND world cannot hide.
    #: A `.wit` may declare several, and only one of them is the world a
    #: descriptor pins -- scanning just the first left the others unexamined.
    extra_worlds: list[tuple[str, list[str]]] = field(default_factory=list)

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

    # EVERY world in the file, in declaration order. Pinning only the first
    # would leave a second world -- which may be the one actually built, and
    # which may import host surface -- permanently unexamined.
    worlds: list[tuple[str, list[str]]] = []
    for world_match in _WORLD.finditer(text):
        body = _world_body(text, world_match.end() - 1)
        worlds.append((world_match.group("name"), _imports_in(body)))

    world_name = worlds[0][0] if worlds else None
    imports = worlds[0][1] if worlds else []
    return World(
        component=component,
        package_id=package_id,
        version=version,
        world=world_name,
        imports=imports,
        extra_worlds=worlds[1:],
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
                    f"-> a consumer pinning that world would match nothing this "
                    f"descriptor declares"
                )

    # ── capabilities must EXACTLY cover the WIT import surface ───────────
    # Two directions, and the second is the one that matters as the contract
    # evolves. Declaring more than the WIT imports is a widened grant; leaving
    # a WIT import UNGRANTED is the same defect seen from the other side --
    # the component reaches host surface no declared capability authorises.
    # A subset check alone (`declared <= imports`) passes a world that gains an
    # import while the descriptor still grants nothing, which is precisely the
    # "pure computation today, not necessarily tomorrow" shape this gate exists
    # to survive.
    declared_caps = descriptor.get("capabilities") or []
    if not isinstance(declared_caps, list):
        verdict.findings.append(
            f"{world.component}: capabilities must be an array, got "
            f"{type(declared_caps).__name__}"
        )
    else:
        imported = sorted(set(world.imports))
        declared_set = set(declared_caps)
        for capability in declared_caps:
            if capability not in set(imported):
                verdict.findings.append(
                    f"{world.component}: capability {capability!r} is not in the WIT "
                    f"world '{world.world}' import surface "
                    f"({imported if imported else 'no imports'}) -- declared "
                    f"wider than the contract grants"
                )
        for missing in imported:
            if missing not in declared_set:
                verdict.findings.append(
                    f"{world.component}: the WIT world '{world.world}' imports "
                    f"{missing!r} but the descriptor grants no matching capability "
                    f"-- ungranted host surface (declared {sorted(declared_set) or 'none'})"
                )

    # ── a second world must not hide an import surface ───────────────────
    # Only the first world is the one a descriptor pins, but a `.wit` may hold
    # several and any of them can carry imports. Report them so a world that
    # is not the pinned one cannot quietly widen the component's host surface.
    for other_name, other_imports in world.extra_worlds:
        if other_imports:
            verdict.findings.append(
                f"{world.component}: world '{other_name}' (declared after the pinned "
                f"'{world.world}') imports {sorted(set(other_imports))} -- this file "
                f"declares more than one world, so the descriptor's pinned world is "
                f"ambiguous and the extra import surface is unaccounted for"
            )

    # ── the payload digest must be the artifact's real digest ────────────
    resources = descriptor.get("resources") or []
    if not resources:
        verdict.findings.append(
            f"{world.component}: no [[resources]] -- a wasm.component descriptor "
            f"must ship its payload"
        )
    for index, entry in enumerate(resources):
        # The entry itself must be a table. TOML accepts `resources = ["x.wasm"]`
        # (a string), and an unguarded `.get` on it raised AttributeError --
        # a traceback instead of the "name the offending field" contract this
        # gate promises. `exactly-one` also refuses duplicates, which no
        # consumer could resolve (the shape akivili already rejects for
        # webui.page-type).
        if not isinstance(entry, dict):
            verdict.findings.append(
                f"{world.component}: resources[{index}] is a "
                f"{type(entry).__name__}, not a table -- each resource must be "
                f"a `[[resources]]` table with a kind and a payload"
            )
            continue
        # `kind` is a seam field akivili consumes (its store walks resources by
        # payload, and hosts filter on the kind tag): a descriptor whose form
        # says wasm.component while its resource says something else is
        # internally inconsistent, and the registry would file the payload
        # under the wrong tag without noticing.
        kind = entry.get("kind")
        if kind != FORM:
            verdict.findings.append(
                f"{world.component}: resources[{index}].kind is {kind!r} but the "
                f"descriptor's form is {FORM!r} -- the payload would be filed under "
                f"the wrong tag"
            )
            continue
        payload = entry.get("payload") or {}
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
                f"{candidate} -- digest unverified. Build it: {BUILD_COMMAND} "
                f"(honours CARGO_TARGET_DIR; pass --artifacts <dir> to point this "
                f"gate somewhere else)"
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


def _default_artifact_dir(repo: Path) -> Path | None:
    """Where this checkout's build leaves the ``.wasm`` files, or ``None``.

    The descriptors declare ``target/wasm32-wasip2/release/<c>.wasm`` — a path
    relative to the *repository* — which is exactly where an unconfigured
    ``cargo build`` writes. It is not where a configured one writes: the
    workspace convention is a task-local ``CARGO_TARGET_DIR``
    (``/mnt/work/target-<task>``), and the build that satisfies this gate then
    leaves the artifact outside the checkout entirely. Without this the gate
    said "digest unverified" about an artifact the caller had just produced,
    and the only way through was to repeat the path by hand.

    An explicit ``--artifacts`` still wins; this only fills the default.
    """
    configured = os.environ.get("CARGO_TARGET_DIR")
    if configured:
        # cargo resolves a RELATIVE CARGO_TARGET_DIR against the directory it
        # runs in, and every build in this repository is spawned with that set
        # to the checkout root (`build.py`, the CI steps, the task lanes). A
        # bare ``Path(configured)`` resolves against THIS process's cwd
        # instead, so running the gate from anywhere else reported "artifacts
        # absent" for artifacts that exist — the same class of defect `build.py`
        # had in review round 2, found here in round 4. An absolute value is
        # unaffected by the join.
        candidate = (repo / configured / "wasm32-wasip2" / "release").resolve()

        if candidate.is_dir():
            return candidate
    return None


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
        f"own path, i.e. {DEFAULT_ARTIFACT_DIR}/ -- but that path is resolved "
        f"under CARGO_TARGET_DIR when it is set, which is where `{BUILD_COMMAND}` "
        f"leaves them)",
    )
    parser.add_argument("--quiet", action="store_true", help="only print failures")
    parser.add_argument(
        "--allow-unverified",
        action="store_true",
        help=f"exit {EXIT_OK} (instead of {EXIT_UNVERIFIED}) when artifacts are absent "
        f"and a digest cannot be proven -- announce, never assume",
    )
    args = parser.parse_args(argv)

    repo = Path(args.repo).resolve()
    if not repo.is_dir():
        print(f"component-descriptor: --repo is not a directory: {repo}", file=sys.stderr)
        return EXIT_USAGE
    artifacts = Path(args.artifacts).resolve() if args.artifacts else _default_artifact_dir(repo)

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
    # An unverified digest is NOT a pass. Exiting 0 here made "the artifact is
    # absent" indistinguishable from "the artifact matches", which is the exact
    # silent-green shape the gate exists to prevent: the only caller that can
    # see the difference is a human reading stderr. `--allow-unverified` is the
    # explicit opt-in for a lane that genuinely has no artifacts (a docs-only
    # checkout), and it announces itself.
    unreached_count = sum(len(v.unreached) for v in verdicts)
    if unreached_count:
        print(
            f"component-descriptor: {len(verdicts)} descriptor(s) matched their WIT, "
            f"but {unreached_count} digest(s) could not be verified (artifacts absent). "
            f"Build them and pass --artifacts <dir>; use --allow-unverified to accept "
            f"this explicitly",
            file=sys.stderr,
        )
        return EXIT_OK if args.allow_unverified else EXIT_UNVERIFIED
    if not args.quiet:
        print(f"component-descriptor: OK {len(verdicts)} descriptor(s), digests verified")
    return EXIT_OK


if __name__ == "__main__":
    sys.exit(main())
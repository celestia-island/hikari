#!/usr/bin/env python3
"""Release guards for hikari's two independent version lines.

hikari carries two officially diverged series: the crates workspace
(``0.3.x``) and the npm package ``@celestia-island/hikari`` (``0.55.x``).
Until 2026-09-27 both release workflows were triggered by the same ``v*``
tag namespace and the npm job published whatever the tag said, with no
floor check — tagging a crates-style ``v0.3.26`` would have published
``0.3.26`` to npm and dragged the ``latest`` dist-tag back by a year
(structural scan S1-2).

This script is the single place that enforces two invariants:

* **npm line** — a version may only be published if it is strictly newer
  than the registry's current ``latest`` (unless ``--allow-downgrade`` is
  passed explicitly, for a deliberate maintenance-line release).
* **crates line** — a version may only be published if it is strictly newer
  than crates.io's current ``max_version`` for the crate.

Both checks fail closed: if the registry cannot be reached or answered, the
guard exits non-zero instead of letting an unverifiable release through.

``--selftest`` runs the comparison fixtures offline and is executed by the
release workflows before the live check, so a regression in this file turns
the release job red instead of silently disarming the guard.

Usage::

    python3 scripts/release_guard.py --selftest
    python3 scripts/release_guard.py --registry npm \
        --package @celestia-island/hikari --version 0.55.83
    python3 scripts/release_guard.py --registry crates \
        --crate hikari-palette --version 0.3.26 [--allow-downgrade]

Exit codes: 0 = guard passed, 1 = guard rejected the release,
2 = guard could not verify (network/parse failure — fail closed).
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import urllib.request

_NPM_DIST_TAGS_URL = "https://registry.npmjs.org/-/package/{pkg}/dist-tags"
_CRATES_API_URL = "https://crates.io/api/v1/crates/{crate}"
_USER_AGENT = "celestia-island-release-guard (hikari)"
_TIMEOUT_SECS = 20

_SEMVER_RE = re.compile(
    r"^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)"
    r"(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)"
    r"(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?$"
)


class SemVer:
    """A minimal semver 2.0.0 value (no build metadata — irrelevant here)."""

    __slots__ = ("prerelease", "release")

    def __init__(self, text: str):
        m = _SEMVER_RE.match(text.strip().lstrip("v") if text.strip().startswith("v") else text.strip())
        if not m:
            raise ValueError(f"not a valid semver version: {text!r}")
        self.release = (int(m.group(1)), int(m.group(2)), int(m.group(3)))
        pre = m.group(4)
        self.prerelease = tuple(pre.split(".")) if pre else ()

    def _pre_key(self):
        # A release sorts above any prerelease of the same x.y.z; encode that
        # by giving releases an empty (lowest) prerelease key per semver.
        if not self.prerelease:
            return ()
        out = []
        for ident in self.prerelease:
            if ident.isdigit():
                out.append((0, int(ident), ""))
            else:
                out.append((1, 0, ident))
        return tuple(out)

    def __lt__(self, other: SemVer) -> bool:
        if self.release != other.release:
            return self.release < other.release
        a, b = self._pre_key(), other._pre_key()
        if a == b:
            return False
        if not a:
            return False  # release vs prerelease: release is greater
        if not b:
            return True
        return a < b

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, SemVer):
            return NotImplemented
        return self.release == other.release and self.prerelease == other.prerelease

    def __le__(self, other: SemVer) -> bool:
        return self == other or self < other

    def __str__(self) -> str:  # pragma: no cover — rendering aid only
        pre = "-" + ".".join(self.prerelease) if self.prerelease else ""
        return ".".join(map(str, self.release)) + pre


def check_not_downgrade(new: str, latest: str, allow_downgrade: bool) -> str:
    """Return an error message, or an empty string when the release may go.

    Equal versions are rejected too: a same-version publish is always an
    accident on these lines (the registry would refuse the duplicate anyway,
    but the guard should say so before any side effects happen).
    """
    new_v, latest_v = SemVer(new), SemVer(latest)
    if allow_downgrade:
        return ""
    if new_v <= latest_v:
        return (
            f"refusing to publish {new}: it is not newer than the registry's "
            f"current version {latest}; a crates-line tag reaching the npm job "
            "(or a typo in a dispatch input) would drag latest backwards — "
            "pass --allow-downgrade only for a deliberate maintenance line"
        )
    return ""


def _fetch_json(url: str):
    req = urllib.request.Request(url, headers={"User-Agent": _USER_AGENT})
    with urllib.request.urlopen(req, timeout=_TIMEOUT_SECS) as resp:
        return json.loads(resp.read().decode("utf-8"))


def fetch_npm_latest(package: str) -> str:
    data = _fetch_json(_NPM_DIST_TAGS_URL.format(pkg=package))
    latest = data.get("latest")
    if not isinstance(latest, str) or not latest:
        raise ValueError(f"npm dist-tags answer carried no 'latest' for {package}: {data!r}")
    return latest


def fetch_crates_max_version(crate: str) -> str:
    data = _fetch_json(_CRATES_API_URL.format(crate=crate))
    crate_obj = data.get("crate", {}) if isinstance(data, dict) else {}
    max_ver = crate_obj.get("max_version")
    if not isinstance(max_ver, str) or not max_ver:
        raise ValueError(f"crates.io answer carried no 'max_version' for {crate}: {data!r}")
    return max_ver


# ── selftest ─────────────────────────────────────────────────────────────────


def _selftest() -> int:
    failures = []

    def expect_ok(new, latest):
        err = check_not_downgrade(new, latest, allow_downgrade=False)
        if err:
            failures.append(f"expected {new} > {latest} to pass, got: {err}")

    def expect_reject(new, latest):
        err = check_not_downgrade(new, latest, allow_downgrade=False)
        if not err:
            failures.append(f"expected {new} <= {latest} to be rejected, but it passed")

    # The S1-2 scenario itself: a crates-line tag must never reach npm.
    expect_reject("0.3.26", "0.55.82")
    expect_reject("0.3.0", "0.55.82")
    # Ordinary progression.
    expect_ok("0.55.83", "0.55.82")
    expect_ok("0.56.0", "0.55.82")
    expect_ok("1.0.0", "0.55.82")
    # Same version is an accident, not a release.
    expect_reject("0.55.82", "0.55.82")
    # Semver ordering across components, not string ordering.
    expect_ok("0.55.100", "0.55.99")
    expect_reject("0.55.9", "0.55.10")
    # A lower minor line is a downgrade even though "6 < 55" looks like a
    # string-order trap — this is exactly the S1-2 shape.
    expect_reject("0.6.0", "0.55.82")
    expect_reject("0.5.99", "0.6.0")
    # A prerelease of a higher major is still newer than any 0.x release.
    expect_ok("1.0.0-0", "0.55.999")
    # Prerelease semantics: pre < release of same triple, numeric ids < alpha.
    expect_ok("0.55.83", "0.55.83-beta.1")
    expect_reject("0.55.83-beta.1", "0.55.83")
    expect_ok("0.55.83-beta.2", "0.55.83-beta.1")
    expect_ok("0.55.83-rc.1", "0.55.83-beta.9")
    expect_reject("0.55.83-alpha", "0.55.83-alpha.1")
    # Explicit downgrade opt-in only for deliberate maintenance lines.
    if check_not_downgrade("0.55.84", "0.56.0", allow_downgrade=True):
        failures.append("--allow-downgrade must permit an explicit lower line")
    # Parsing rejects garbage instead of guessing.
    for bad in ("v0.55", "0.55.x", "latest", "", "0.55.83+build"):
        try:
            SemVer(bad)
            failures.append(f"SemVer({bad!r}) should have raised")
        except ValueError:
            pass

    if failures:
        print("release_guard selftest FAILED:", file=sys.stderr)
        for f in failures:
            print(f"  - {f}", file=sys.stderr)
        return 1
    print("release_guard selftest passed (comparison fixtures all green)")
    return 0


# ── CLI ──────────────────────────────────────────────────────────────────────


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(prog="release_guard", description=__doc__.splitlines()[0])
    parser.add_argument("--selftest", action="store_true", help="run the offline fixture suite and exit")
    parser.add_argument("--registry", choices=("npm", "crates"))
    parser.add_argument("--package", help="npm package name (registry=npm)")
    parser.add_argument("--crate", help="crates.io crate name (registry=crates)")
    parser.add_argument("--version", help="version about to be published")
    parser.add_argument(
        "--allow-downgrade",
        action="store_true",
        help="explicitly permit publishing below the registry version (deliberate maintenance line)",
    )
    parser.add_argument(
        "--latest",
        help=argparse.SUPPRESS,  # test affordance: compare against this instead of querying
    )
    args = parser.parse_args(argv)

    if args.selftest:
        return _selftest()

    if not args.registry or not args.version:
        parser.error("--registry and --version are required (or pass --selftest)")
    if args.registry == "npm" and not args.package:
        parser.error("--package is required with --registry npm")
    if args.registry == "crates" and not args.crate:
        parser.error("--crate is required with --registry crates")

    try:
        new_ver = SemVer(args.version)
    except ValueError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1

    try:
        if args.latest is not None:
            latest = args.latest
        elif args.registry == "npm":
            latest = fetch_npm_latest(args.package)
        else:
            latest = fetch_crates_max_version(args.crate)
        latest_ver = SemVer(latest)
    except Exception as exc:  # noqa: BLE001 — any failure here must fail the release closed
        print(
            f"error: could not establish the registry's current version "
            f"({args.registry}); refusing to publish unverifiable releases: {exc}",
            file=sys.stderr,
        )
        return 2

    err = check_not_downgrade(str(new_ver), str(latest_ver), allow_downgrade=args.allow_downgrade)
    if err:
        print(f"error: {err}", file=sys.stderr)
        return 1
    print(f"release guard ok: {args.version} > {latest} ({args.registry})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

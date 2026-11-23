#!/usr/bin/env python3
"""Refuse an npm package that would ship without the generated wasm bindings.

``packages/vue/src/wasm/{qr,mermaid,scene3d,highlight}/`` is jco output and is
gitignored, but it is still **shipped**: ``files`` lists ``src/`` and the Vue
layer imports those modules for real, so ``@celestia-island/hikari`` without
them is a package whose four WASM-backed components fail to load for every
consumer.

Retiring the checked-in copies moves the failure mode from "a stale committed
tree" to "a publish from a checkout that never built them". ``npm publish``
runs its ``prepublishOnly`` script; this is what that script starts with. The
check reads the ``npm pack`` manifest rather than the working tree, because
the manifest is the thing the registry receives — a ``.npmignore``, a narrowed
``files`` entry or a future ignore rule changes it, and the tree would not
show that.

Usage: python3 packages/wasm/check_npm_pack.py [--package-dir packages/vue]
"""
import argparse
import json
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
COMPONENTS = ("qr", "mermaid", "scene3d", "highlight")
#: Every component's generated entry is JS plus its declaration; one of each per
#: component is enough to prove the directory travelled, and the count pin then
#: catches a partial copy (jco writes 17-19 files per component).
#:
#: The entry module ``hikari_wasm_<c>.js`` is the one the Vue layer imports at
#: runtime — the two ``.d.ts`` entries are types. Everything else in the
#: directory is reachable only through it. That is why this list is asserted by
#: ``check_npm_pack_test.py``: a narrowed list still "passes" on a tree whose
#: shipped modules are all absent (measured: deleting the ``.js`` entry made
#: this script certify exactly that), so the list itself has to be pinned.
REQUIRED_SUFFIXES = (
    "{c}/hikari_wasm_{c}.js",
    "{c}/hikari_wasm_{c}.d.ts",
    "{c}/interfaces/celestia-hikari-{c}-types.d.ts",
)

#: The one suffix a runtime import resolves to. Kept as its own name so the test
#: can assert it is still IN ``REQUIRED_SUFFIXES`` rather than trusting a reader.
ENTRY_SUFFIX = "{c}/hikari_wasm_{c}.js"


def packed_files(package_dir: Path) -> list[str]:
    """The paths ``npm pack --dry-run`` would put in the tarball."""
    result = subprocess.run(
        ["npm", "pack", "--dry-run", "--json"],
        cwd=package_dir, check=True, capture_output=True, text=True,
    )
    manifest = json.loads(result.stdout)
    if not manifest:
        raise SystemExit("error: `npm pack --dry-run --json` produced no manifest")
    return [entry["path"] for entry in manifest[0].get("files", [])]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--package-dir", default=str(ROOT / "packages" / "vue"))
    args = parser.parse_args(argv)
    package_dir = Path(args.package_dir).resolve()

    return report(COMPONENTS, set(packed_files(package_dir)))


def report(components: tuple[str, ...], files: set[str]) -> int:
    """The verdict for one manifest's path set (``0`` = every component travelled)."""
    missing = [
        f"src/wasm/{suffix.format(c=c)}"
        for c in components
        for suffix in REQUIRED_SUFFIXES
        if f"src/wasm/{suffix.format(c=c)}" not in files
    ]
    if missing:
        print(
            "error: the npm package would ship without generated wasm bindings:\n"
            + "".join(f"       missing from `npm pack`: {path}\n" for path in missing)
            + "       They are jco output and are not checked in. Build them first:\n"
            + "         python3 packages/wasm/build.py\n"
            + "       (then re-run `npm pack --dry-run`; the `files` field already\n"
            + "        carries `src/`, so a built tree packs them unchanged)",
            file=sys.stderr,
        )
        return 1

    print(f"check_npm_pack: {len(components)} component(s) present in the npm manifest")
    return 0


if __name__ == "__main__":
    sys.exit(main())
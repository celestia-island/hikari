#!/usr/bin/env python3
"""Re-copy the vendored theme stylesheets from their upstream sources.

  packages/vue/src/tokens.scss  -> packages/vue/src/styles/theme/channels.scss
  packages/vue/src/scale.scss   -> packages/vue/src/styles/theme/scale.scss
  packages/theme/styles/_scrollbar.scss -> packages/vue/src/styles/theme/scrollbar.scss

Each vendored file keeps its existing provenance header (everything up to
and including the "do not hand-edit here." marker line); only the body is
refreshed from upstream. Run this after editing an upstream sheet, then
`pnpm -C packages/vue vitest run src/styles/vendoredSync.test.ts` (or the
full suite) — vendoredSync.test.ts fails on any drift.

Usage: scripts/theme/sync-vendored.py   (from the repo root)

Converted from scripts/theme/sync-vendored.sh on 2026-10-06 per the
workspace tooling-script policy (AGENTS.md §7.5, extended 2026-10-06).
"""

import os
import sys
import tempfile
from pathlib import Path

root = Path(__file__).resolve().parent.parent.parent
vue_styles = root / "packages" / "vue" / "src" / "styles"


def sync(vendored: Path, upstream: Path) -> None:
    if not vendored.is_file():
        print(f"vendored file missing: {vendored}", file=sys.stderr)
        sys.exit(1)
    if not upstream.is_file():
        print(f"upstream file missing: {upstream}", file=sys.stderr)
        sys.exit(1)

    lines = vendored.read_bytes().splitlines(keepends=True)
    marker = next((i for i, line in enumerate(lines) if b"do not hand-edit here." in line), None)
    if marker is None:
        # The bash original never printed its "no provenance marker" message:
        # under `set -euo pipefail` the marker=$(grep … | head … | cut …)
        # assignment itself failed on a grep no-match and killed the script
        # first. Keep the same silent exit 1.
        sys.exit(1)

    candidate = b"".join(lines[: marker + 1]) + b"\n" + upstream.read_bytes()
    if candidate == vendored.read_bytes():
        return

    # Write through a temp file in the same directory so the replace stays
    # atomic (the shell version wrote mktemp(1) output and mv(1)'d it over).
    fd, tmp_name = tempfile.mkstemp(dir=str(vendored.parent))
    try:
        with os.fdopen(fd, "wb") as tmp:
            tmp.write(candidate)
        os.replace(tmp_name, vendored)
    except BaseException:
        try:
            os.unlink(tmp_name)
        except FileNotFoundError:
            pass
        raise
    print(f"synced {vendored.relative_to(root)}")


def main() -> int:
    sync(
        vue_styles / "theme" / "channels.scss",
        root / "packages" / "vue" / "src" / "tokens.scss",
    )
    sync(
        vue_styles / "theme" / "scale.scss",
        root / "packages" / "vue" / "src" / "scale.scss",
    )
    sync(
        vue_styles / "theme" / "scrollbar.scss",
        root / "packages" / "theme" / "styles" / "_scrollbar.scss",
    )

    print("vendored stylesheets are in sync")
    return 0


if __name__ == "__main__":
    sys.exit(main())

#!/bin/bash
# Re-copy the vendored theme stylesheets from their upstream sources.
#
#   packages/theme/styles/*.scss  -> packages/vue/src/styles/theme/*.scss
#   packages/vue/src/tokens.scss  -> packages/vue/src/styles/theme/channels.scss
#
# Each vendored file keeps its existing provenance header (everything up to
# and including the "do not hand-edit here." marker line); only the body is
# refreshed from upstream. Run this after editing an upstream sheet, then
# `pnpm -C packages/vue vitest run src/styles/vendoredSync.test.ts` (or the
# full suite) — vendoredSync.test.ts fails on any drift.
#
# Usage: scripts/theme/sync-vendored.sh   (from the repo root)

set -euo pipefail

root="$(cd "$(dirname "$0")/../.." && pwd)"
vue_styles="$root/packages/vue/src/styles"

sync() { # <vendored-file> <upstream-file>
  local vendored="$1" upstream="$2"
  [ -f "$vendored" ] || { echo "vendored file missing: $vendored" >&2; exit 1; }
  [ -f "$upstream" ] || { echo "upstream file missing: $upstream" >&2; exit 1; }
  local marker
  marker=$(grep -n "do not hand-edit here." "$vendored" | head -1 | cut -d: -f1)
  [ -n "$marker" ] || { echo "no provenance marker in $vendored" >&2; exit 1; }
  local tmp
  tmp="$(mktemp)"
  head -n "$marker" "$vendored" > "$tmp"
  printf '\n' >> "$tmp"
  cat "$upstream" >> "$tmp"
  if cmp -s "$tmp" "$vendored"; then
    rm -f "$tmp"
  else
    mv "$tmp" "$vendored"
    echo "synced $(realpath --relative-to="$root" "$vendored")"
  fi
}

for base in base foundation themes _tokens _layout variables mixins _glass _scrollbar; do
  sync "$vue_styles/theme/$base.scss" "$root/packages/theme/styles/$base.scss"
done
sync "$vue_styles/theme/channels.scss" "$root/packages/vue/src/tokens.scss"

echo "vendored stylesheets are in sync"

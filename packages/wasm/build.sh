#!/bin/bash
# Build the hikari wasm components and generate JS bindings.
#
# For each component under packages/wasm/:
#   1. cargo build --target wasm32-wasip2 --release
#   2. jco transpile → JS bindings
#   3. copy bindings into packages/vue/src/wasm/ (consumed by the Vue layer)
#
# Usage: packages/wasm/build.sh [component-dir]
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
VUE_DST="$ROOT/packages/vue/src/wasm"
JCO="$(command -v jco || echo "$HOME/.nvm/versions/node/$(node -v)/lib/node_modules/.bin/jco")"
mkdir -p "$VUE_DST"

for comp in "${@:-$(ls -d "$HERE"/*/ 2>/dev/null | xargs -n1 basename)}"; do
  CRATE_DIR="$HERE/$comp"
  [ -f "$CRATE_DIR/Cargo.toml" ] || { echo "skip $comp (no Cargo.toml)"; continue; }
  CRATE_NAME=$(basename "$comp")
  echo "── building $CRATE_NAME..."
  (cd "$ROOT" && cargo build --target wasm32-wasip2 --release -p "hikari-wasm-$CRATE_NAME")
  WASM=$(find "${CARGO_TARGET_DIR:-$ROOT/target}/wasm32-wasip2/release" -name "hikari_wasm_${CRATE_NAME//-/_}.wasm" 2>/dev/null | head -1)
  [ -n "$WASM" ] || { echo "ERROR: no wasm for $CRATE_NAME"; exit 1; }
  OUT="$VUE_DST/$CRATE_NAME"
  rm -rf "$OUT"; mkdir -p "$OUT"
  "$JCO" transpile "$WASM" -o "$OUT"
  echo "── $CRATE_NAME → $OUT ($(du -sh "$OUT" | cut -f1))"
done
echo "done"

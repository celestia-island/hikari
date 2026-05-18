#!/usr/bin/env bash
# Download MDI SVG icons from GitHub and extract to workspace.
# Replaces scripts/icons/fetch_mdi_icons.py
set -euo pipefail

WORKSPACE_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ICONS_DIR="${WORKSPACE_ROOT}/icons/mdi"
MDI_URL="https://github.com/Templarian/MaterialDesign/archive/refs/heads/master.zip"
TMP_DIR="${TMPDIR:-/tmp}/hikari-icons"

mkdir -p "$TMP_DIR" "$ICONS_DIR"

ZIP_PATH="${TMP_DIR}/mdi.zip"

echo "  -> Downloading MDI icons..."
curl -sfL -o "$ZIP_PATH" "$MDI_URL"

echo "  -> Extracting SVGs..."
unzip -jo "$ZIP_PATH" "MaterialDesign-master/svg/*" -d "$ICONS_DIR" -q

count=$(ls "$ICONS_DIR"/*.svg 2>/dev/null | wc -l)
echo "  v Extracted ${count} icons to ${ICONS_DIR}"

rm -f "$ZIP_PATH"

#!/usr/bin/env bash
# Capture screenshots via tairitsu debug API.
# Requires: tairitsu dev --debug running (just dev --debug)
set -euo pipefail

DEBUG_URL="${1:-http://localhost:3001}"
SITE_URL="${2:-http://localhost:3000}"
OUTPUT_DIR="${3:-target/screenshots}"
WAIT="${4:-3}"

mkdir -p "$OUTPUT_DIR"

captured=0
failed=0

capture() {
    local route="$1" name="$2" fp="${3:-false}"

    if ! curl -sf -X POST "${DEBUG_URL}/navigate" \
         -H 'Content-Type: application/json' \
         -d "{\"url\": \"${SITE_URL}${route}\"}" > /dev/null 2>&1; then
        echo "  x ${name}: navigate failed"
        failed=$((failed + 1))
        return
    fi

    sleep "$WAIT"

    local out="${OUTPUT_DIR}/${name}.png"
    local resp
    resp=$(curl -sf -X POST "${DEBUG_URL}/screenshot" \
        -H 'Content-Type: application/json' \
        -d "{\"full_page\": ${fp}}" 2>/dev/null) || {
        echo "  x ${name}: screenshot failed"
        failed=$((failed + 1))
        return
    }

    local b64
    b64=$(echo "$resp" | jq -r '.data.data // empty' 2>/dev/null)
    if [ -z "$b64" ]; then
        echo "  x ${name}: no screenshot data"
        failed=$((failed + 1))
        return
    fi

    echo "$b64" | base64 -d > "$out"
    local size
    size=$(wc -c < "$out")
    printf "  v %-35s -> %s (%s bytes)\n" "$route" "${name}.png" "$size"
    captured=$((captured + 1))
}

# ── Routes (sync with tests/visual/baseline/default) ──────────────────────

capture "/"                                    home                    true
capture "/components/"                         components_overview     true
capture "/components/layer1/"                  components_layer1       false
capture "/components/layer2/"                  components_layer2       false
capture "/components/layer3/"                  components_layer3       false
capture "/components/layer1/button/index.html" button                  true
capture "/components/layer1/form/index.html"   form_input              true
capture "/components/layer1/switch/index.html" switch                  true
capture "/components/layer1/avatar/index.html" avatar                  true
capture "/components/layer1/tag/index.html"    tag                     false
capture "/components/layer1/search/index.html" search                  false
capture "/components/layer1/empty/index.html"  empty                   false
capture "/components/layer1/feedback/index.html" feedback              true
capture "/components/layer2/table/index.html"  table                   true
capture "/components/layer2/navigation/index.html" navigation          true
capture "/components/layer2/timeline/index.html" timeline              false
capture "/components/layer2/form/index.html"   form_layer2             true
capture "/components/layer3/editor/index.html" editor                  true
capture "/components/layer3/media/index.html"  media                   true
capture "/components/layer3/user-guide/index.html" user_guide          true
capture "/components/layer3/visualization/index.html" visualization    true
capture "/system/palette/index.html"           palette                 true
capture "/system/icons/index.html"             icons                   true
capture "/system/css/index.html"               css_utilities           false
capture "/system/i18n/index.html"              i18n                    false
capture "/system/animations/index.html"        animations_system       false
capture "/animations/index.html"               animations_demo         true
capture "/interactive/index.html"              interactive             true
capture "/demos/dashboard/index.html"          dashboard               true

echo ""
echo "Captured: ${captured}/$((captured + failed))"

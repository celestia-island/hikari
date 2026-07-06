#!/bin/bash
# Simple E2E test for system pages only

echo "Testing system pages..."

routes=(
    "system"
    "system/css"
    "system/icons"
    "system/palette"
    "system/animations"
)

for route in "${routes[@]}"; do
    echo "Testing: $route"
    curl -s "http://localhost:3000/$route" 2>&1 | head -20
    echo ""
done

echo "Done"

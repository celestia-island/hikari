#!/bin/bash
# Run visual quality and interactive behavior tests

set -e

echo "=========================================="
echo "Hikari Visual Quality Test Runner"
echo "=========================================="
echo ""

# Check if Selenium is running
if ! curl -s http://localhost:4444/wd/hub/status > /dev/null; then
    echo "Error: Selenium WebDriver is not running"
    echo "Please start Selenium with:"
    echo "  docker run -d -p 4444:4444 selenium/standalone-chrome"
    exit 1
fi

# Check if website is running
if ! curl -s http://localhost:3000 > /dev/null; then
    echo "Error: Website is not running"
    echo "Please start the website with:"
    echo "  cd examples/website && cargo run --features server"
    exit 1
fi

echo "✓ Selenium WebDriver is running"
echo "✓ Website is running at http://localhost:3000"
echo "  (Will access from Docker as http://host.docker.internal:3000)"
echo ""

# Build the visual quality test binary
echo "Building visual quality test binary..."
cd /mnt/sdb1/hikari/packages/e2e
cargo build --bin hikari-visual-quality

# Run visual quality tests
echo ""
echo "Running visual quality tests..."
cargo run --bin hikari-visual-quality

echo ""
echo "=========================================="
echo "✓ Visual quality tests completed"
echo "=========================================="

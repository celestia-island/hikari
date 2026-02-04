#!/bin/bash
# Blocking E2E screenshot test runner
# Runs all routes sequentially in a single container

set -e

# Configuration
TOTAL_ROUTES=34
IMAGE_NAME="hikari/screenshot:selenium"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=========================================="
echo "Hikari Blocking E2E Screenshot Test Runner"
echo "=========================================="
echo "Total routes: $TOTAL_ROUTES"
echo "=========================================="
echo ""

# Remove old containers
echo -e "${YELLOW}Cleaning up old containers...${NC}"
docker compose -f scripts/docker-compose-selenium.yml down 2>/dev/null || true
docker ps -a --filter "name=hikari-screenshot" -q | xargs -r docker rm -f 2>/dev/null || true
echo ""

# Create output directory
mkdir -p target/e2e_screenshots

# Build base image if needed
echo -e "${YELLOW}Building base image...${NC}"
docker build -t "$IMAGE_NAME" -f docker/base-selenium.Dockerfile . 2>&1 | grep -E "^(Step|Successfully|Sending|Building|built)" || true
echo ""

# Run screenshot test
echo -e "${YELLOW}Running E2E test in blocking mode...${NC}"
echo ""

docker run --rm \
    --name hikari-screenshot \
    --network host \
    -v "$(pwd)/target/e2e_screenshots:/tmp/e2e_screenshots" \
    -v "$(pwd)/examples/website/public:/public:ro" \
    "$IMAGE_NAME" \
    /usr/local/bin/hikari-screenshot

echo ""
echo "=========================================="

# Count screenshots
screenshot_count=$(ls -lh target/e2e_screenshots/*.png 2>/dev/null | wc -l)
echo -e "Screenshots generated: ${GREEN}${screenshot_count}${NC}/${TOTAL_ROUTES}"

if [ "$screenshot_count" -eq "$TOTAL_ROUTES" ]; then
    echo -e "${GREEN}✓ E2E test completed successfully${NC}"
    exit 0
else
    echo -e "${RED}✗ E2E test completed with errors${NC}"
    exit 1
fi

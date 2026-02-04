#!/bin/bash
# Parallel E2E screenshot test runner
# Distributes routes across multiple containers to utilize multiple CPU cores

set -e

# Configuration
TOTAL_ROUTES=34
NUM_CONTAINERS=8  # Adjust based on CPU cores (8 containers = ~4-5 routes per container)
ROUTES_PER_CONTAINER=$(( (TOTAL_ROUTES + NUM_CONTAINERS - 1) / NUM_CONTAINERS ))
IMAGE_NAME="hikari/screenshot:selenium"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=========================================="
echo "Hikari Parallel E2E Screenshot Test Runner"
echo "=========================================="
echo "Total routes: $TOTAL_ROUTES"
echo "Number of containers: $NUM_CONTAINERS"
echo "Routes per container: $ROUTES_PER_CONTAINER"
echo "=========================================="
echo ""

# Remove old containers
echo -e "${YELLOW}Cleaning up old containers...${NC}"
docker compose -f scripts/docker-compose-selenium.yml down 2>/dev/null || true
docker ps -a --filter "name=hikari-screenshot-" -q | xargs -r docker rm -f 2>/dev/null || true
echo ""

# Create output directory
mkdir -p target/e2e_screenshots

# Build base image if needed
echo -e "${YELLOW}Building base image...${NC}"
docker build -t "$IMAGE_NAME" -f docker/base-selenium.Dockerfile . 2>&1 | grep -E "^(Step|Successfully|Sending|Building|built)" || true
echo ""

# Function to run a single container
run_container() {
    local container_id=$1
    local start_idx=$2
    local end_idx=$3

    echo -e "${GREEN}Starting container hikari-screenshot-${container_id} (routes ${start_idx}..${end_idx})${NC}"

    docker run --rm \
        --name "hikari-screenshot-${container_id}" \
        --network host \
        -v "$(pwd)/target/e2e_screenshots:/tmp/e2e_screenshots" \
        -v "$(pwd)/examples/website/public:/public:ro" \
        "$IMAGE_NAME" \
        /usr/local/bin/hikari-screenshot \
        --start "${start_idx}" \
        --end "${end_idx}" \
        > "logs/screenshot-${container_id}.log" 2>&1

    local exit_code=$?
    if [ $exit_code -eq 0 ]; then
        echo -e "${GREEN}✓ Container hikari-screenshot-${container_id} completed successfully${NC}"
    else
        echo -e "${RED}✗ Container hikari-screenshot-${container_id} failed with exit code ${exit_code}${NC}"
    fi
    return $exit_code
}

# Create logs directory
mkdir -p logs

# Launch containers in parallel
echo -e "${YELLOW}Launching ${NUM_CONTAINERS} containers in parallel...${NC}"
echo ""

container_pids=()

for ((i = 0; i < NUM_CONTAINERS; i++)); do
    start_idx=$((i * ROUTES_PER_CONTAINER))
    end_idx=$((start_idx + ROUTES_PER_CONTAINER))
    if [ $end_idx -gt $TOTAL_ROUTES ]; then
        end_idx=$TOTAL_ROUTES
    fi

    if [ $start_idx -ge $TOTAL_ROUTES ]; then
        break
    fi

    # Run container in background
    run_container "$i" "$start_idx" "$end_idx" &
    container_pids+=($!)

    # Small delay to stagger container launches
    sleep 0.5
done

echo ""
echo -e "${YELLOW}Waiting for all containers to complete...${NC}"
echo ""

# Wait for all containers and collect exit codes
all_success=true
for pid in "${container_pids[@]}"; do
    if ! wait "$pid"; then
        all_success=false
    fi
done

echo ""
echo "=========================================="
if [ "$all_success" = true ]; then
    echo -e "${GREEN}✓ All containers completed successfully${NC}"
else
    echo -e "${RED}✗ Some containers failed${NC}"
fi
echo "=========================================="
echo ""

# Count screenshots
screenshot_count=$(ls -lh target/e2e_screenshots/*.png 2>/dev/null | wc -l)
echo -e "Screenshots generated: ${GREEN}${screenshot_count}${NC}/${TOTAL_ROUTES}"

if [ "$all_success" = true ] && [ "$screenshot_count" -eq "$TOTAL_ROUTES" ]; then
    echo -e "${GREEN}✓ E2E test completed successfully${NC}"
    exit 0
else
    echo -e "${RED}✗ E2E test completed with errors${NC}"
    exit 1
fi

# Base image for Hikari E2E screenshot tests
# Contains pre-compiled screenshot binary and Selenium Chrome environment
# Use locally compiled binary (to avoid edition2024 issues in Docker)

FROM selenium/standalone-chrome:latest

# Switch to root user
USER root

# Set working directory
WORKDIR /app

# Copy locally compiled binary
COPY target/release/hikari-screenshot /usr/local/bin/hikari-screenshot

# Make binary executable
RUN chmod +x /usr/local/bin/hikari-screenshot

# Create output directory for screenshots
RUN mkdir -p /tmp/e2e_screenshots

# Set environment variables
ENV CHROME_BIN=/usr/bin/google-chrome \
    SCREENSHOT_DIR=/tmp/e2e_screenshots

# Use host network to allow access to localhost:3000
# This allows the container to connect to services running on the host machine
# For Linux: use host.docker.internal, for Docker Desktop use host-gateway
ENV BASE_URL=http://host.docker.internal:3000

# Default command (can be overridden with --route-range)
CMD ["/usr/local/bin/hikari-screenshot", "--start", "0"]


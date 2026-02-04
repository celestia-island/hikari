# Screenshot Dockerfile using Selenium Chrome image
# Uses pre-installed Chrome 144

FROM selenium/standalone-chrome:latest

WORKDIR /hikari

# Switch to root for system operations
USER root

# Remove old binary if exists
RUN rm -f /usr/local/bin/hikari-screenshot

# Copy pre-built screenshot tool from local build
COPY target/debug/hikari-screenshot /usr/local/bin/

# Set executable permissions
RUN chmod +x /usr/local/bin/hikari-screenshot

# Set environment variables
ENV RUST_BACKTRACE=1
ENV RUST_LOG=info
ENV CHROME_BIN=/usr/bin/google-chrome

# Create output directory in container
RUN mkdir -p /tmp/e2e_screenshots && \
    chmod 777 /tmp/e2e_screenshots

# Stay as root to avoid permission issues
# USER seluser

# Default command: run screenshot tool
CMD ["/usr/local/bin/hikari-screenshot"]

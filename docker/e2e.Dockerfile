# E2E Testing Dockerfile for Hikari
# This Dockerfile sets up a complete testing environment with Chrome

# Multi-stage build
# Stage 1: Build the project
FROM rust:1.75.0-slim as builder

WORKDIR /hikari

# Copy workspace files
COPY . .

# Install build dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Build workspace (including E2E)
RUN cargo build --workspace

# Stage 2: Runtime environment with Chrome
FROM rust:1.75.0-slim as runtime

WORKDIR /hikari

# Install Chrome browser
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# Install Chrome
RUN wget -q -O - https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb > /tmp/chrome.deb && \
    apt-get install -y /tmp/chrome.deb && \
    rm /tmp/chrome.deb

# Copy build artifacts from builder
COPY --from=builder /hikari/target /hikari/target
COPY --from=builder /hikari/packages/e2e /hikari/packages/e2e

# Set environment variables
ENV RUST_BACKTRACE=1
ENV RUST_LOG=info

# Expose ports for website
EXPOSE 3000

# Default command: start website and run E2E tests
CMD ["bash", "-c", "cd /hikari/examples/website && cargo run --bin website --features server & sleep 10 && cd /hikari/packages/e2e && cargo run --bin e2e"]

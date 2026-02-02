# Hikari Website Dockerfile
# This Dockerfile builds and runs the Hikari website example

FROM rust:1.85-slim as builder

WORKDIR /hikari

# Install build dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    ca-certificates \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

# Install Rust target for WASM
RUN rustup target add wasm32-unknown-unknown

# Copy workspace files
COPY . .

# Install Python dependencies
RUN pip3 install --break-system-packages beautifulsoup4 lxml

# Fetch MDI icons (skip for now - icons already generated)
# RUN python3 scripts/icons/fetch_mdi_icons.py

# Build workspace
# RUN cargo build --package hikari-builder

# Clear Cargo cache (keep registry for caching)
# RUN rm -rf ~/.cargo/registry/src/* && rm -f examples/website/Cargo.lock

# Build WASM library
RUN cargo build --lib --target wasm32-unknown-unknown --manifest-path examples/website/Cargo.toml

# Runtime stage
FROM rust:1.85-slim

WORKDIR /hikari

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy build artifacts from builder
COPY --from=builder /hikari/target /hikari/target
COPY --from=builder /hikari/examples/website /hikari/examples/website
COPY --from=builder /hikari/public /hikari/public

# Set environment variables
ENV RUST_BACKTRACE=1
ENV RUST_LOG=info

# Expose port 3000
EXPOSE 3000

# Default command: start website server
CMD ["cargo", "run", "--manifest-path", "examples/website/Cargo.toml", "--features", "server"]

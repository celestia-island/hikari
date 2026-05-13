# Hikari Website Dockerfile
# This Dockerfile builds and runs the Hikari website example

FROM rust:1.85-slim as builder

WORKDIR /hikari

# Install build dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    ca-certificates \
    git \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

# Install Rust target for WASM
RUN rustup target add wasm32-wasip2

# Copy workspace files
COPY . .

# Fetch sibling tairitsu repository required by tairitsu-packager
RUN git clone --depth 1 https://github.com/celestia-island/tairitsu.git /tairitsu

# Install Python dependencies
RUN pip3 install --break-system-packages beautifulsoup4 lxml

# Fetch MDI icons (skip for now - icons already generated)
# RUN python3 scripts/icons/fetch_mdi_icons.py

# Stage website source assets and build final public output
RUN python3 scripts/build/compile_scss.py
RUN cd examples/website && cargo run --manifest-path /tairitsu/packages/packager/Cargo.toml -- --manifest-path Cargo.toml build

# Runtime stage
FROM rust:1.85-slim

WORKDIR /hikari

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy build artifacts from builder
COPY --from=builder /hikari/public /hikari/public

# Set environment variables
ENV RUST_BACKTRACE=1
ENV RUST_LOG=info

# Expose port 3000
EXPOSE 3000

# Default command: serve final public directory via a simple HTTP server
CMD ["python3", "-m", "http.server", "3000", "--directory", "/hikari/public"]

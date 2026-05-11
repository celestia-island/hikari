FROM rust:1.85-slim AS builder

WORKDIR /build

RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    ca-certificates \
    git \
    python3 \
    python3-venv \
    && rm -rf /var/lib/apt/lists/*

RUN rustup target add wasm32-wasip2

COPY hikari /build/hikari
COPY tairitsu /build/tairitsu

RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
RUN pip install beautifulsoup4 lxml

WORKDIR /build/hikari

RUN python3 scripts/build/compile_scss.py
RUN cd examples/website && cargo run --manifest-path /build/tairitsu/packages/packager/Cargo.toml -- --manifest-path Cargo.toml build

FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y \
    ca-certificates \
    python3 \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid 1000 hikari \
    && useradd --uid 1000 --gid hikari --create-home hikari

WORKDIR /hikari

COPY --from=builder /build/hikari/public /hikari/public

USER hikari

ENV RUST_BACKTRACE=1
ENV RUST_LOG=info

EXPOSE 3000

CMD ["python3", "-m", "http.server", "3000", "--directory", "/hikari/public"]

FROM rust:1.85-slim AS builder

WORKDIR /hikari

RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    ca-certificates \
    git \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

RUN rustup target add wasm32-wasip2

COPY . .

RUN git clone --depth 1 https://github.com/celestia-island/tairitsu.git /tairitsu

RUN pip3 install --break-system-packages beautifulsoup4 lxml

RUN python3 scripts/build/compile_scss.py
RUN cd examples/website && cargo run --manifest-path /tairitsu/packages/packager/Cargo.toml -- --manifest-path Cargo.toml build

FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y \
    ca-certificates \
    python3 \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid 1000 hikari \
    && useradd --uid 1000 --gid hikari --create-home hikari

WORKDIR /hikari

COPY --from=builder /hikari/public /hikari/public

USER hikari

ENV RUST_BACKTRACE=1
ENV RUST_LOG=info

EXPOSE 3000

CMD ["python3", "-m", "http.server", "3000", "--directory", "/hikari/public"]

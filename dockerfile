FROM rust:latest as stage-deps

RUN cargo new --name playground /home/src/playground
WORKDIR /home/src/playground

# COPY ./src/backend/database/Cargo.toml /home/src/playground/Cargo.toml
# RUN cargo build --release

COPY ./src/backend/router/Cargo.toml /home/src/playground/Cargo.toml
# Polyfill
RUN cargo new --name hikari-database /home/src/database
RUN cargo new --name hikari-web /home/frontend/web
RUN cargo build --release

# COPY ./src/frontend/web/Cargo.toml /home/src/playground/Cargo.toml
# RUN cargo build --release

# The dependencies are now cached in the image, so we can copy them to the next stage
# without having to rebuild them.
RUN mv /home/src/playground/target /home/target
RUN mv /home/src/playground/Cargo.lock /home/Cargo.lock

FROM rust:latest as stage-client-build1

RUN rustup target add wasm32-unknown-unknown
COPY --from=stage-deps /home/target /home/target
COPY --from=stage-deps /home/Cargo.lock /home/Cargo.lock
COPY ./src /home/src
COPY ./Cargo.toml /home/Cargo.toml
WORKDIR /home/src
RUN cargo build --package hikari-web --bin hikari-web --release --target wasm32-unknown-unknown

FROM rust:latest as stage-client-build2

RUN cargo install wasm-bindgen-cli
COPY --from=stage-client-build1 /home/target/wasm32-unknown-unknown/release/hikari-web.wasm /home/a.wasm
WORKDIR /home
RUN wasm-bindgen a.wasm --out-dir /home/dist --target no-modules --no-typescript

FROM rust:latest as stage-client-build3

RUN cargo install wasm-opt
COPY --from=stage-client-build2 /home/dist /home/dist
WORKDIR /home/dist
RUN wasm-opt -Oz -o a.wasm a_bg.wasm
RUN rm a_bg.wasm

FROM rust:latest as stage-server-build1

COPY --from=stage-deps /home/target /home/target
COPY --from=stage-deps /home/Cargo.lock /home/Cargo.lock
COPY ./src /home/src
COPY ./Cargo.toml /home/Cargo.toml
WORKDIR /home/src/backend/router
RUN cargo build --package hikari-router --bin hikari-router --release

FROM ubuntu:22.10 as stage-server-build2

COPY --from=stage-client-build3 /home/dist /home/dist
COPY --from=stage-server-build1 /home/target/release/hikari-router /home/a
WORKDIR /home
ENTRYPOINT [ "./a" ]
EXPOSE 80

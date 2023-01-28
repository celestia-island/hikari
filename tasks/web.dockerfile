FROM rust:latest as stage-client-deps

RUN rustup target add wasm32-unknown-unknown
RUN cargo new --name hikari-router /home/packages/router
COPY ./packages/router/Cargo.toml /home/packages/router/Cargo.toml
RUN cargo new --name hikari-database /home/packages/database
COPY ./packages/database/Cargo.toml /home/packages/database/Cargo.toml
RUN cargo new --name hikari-web /home/packages/web
COPY ./packages/web/Cargo.toml /home/packages/web/Cargo.toml
RUN cargo new --name hikari-web /home/packages/app
COPY ./packages/app/Cargo.toml /home/packages/app/Cargo.toml
COPY ./Cargo.toml /home/Cargo.toml

FROM stage-client-deps as stage-client-build1

WORKDIR /home/packages/web
RUN cargo build --release --target wasm32-unknown-unknown

RUN rm -r /home/packages
COPY ./packages /home/packages
WORKDIR /home/packages/web
RUN cargo build --release --target wasm32-unknown-unknown --features web_env

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

FROM stage-client-deps as stage-server-build1

WORKDIR /home
RUN cargo build --bin hikari-router --package hikari-router --release

RUN rm -r /home/packages
COPY ./packages /home/packages
WORKDIR /home/packages/router
RUN cargo build --release

FROM ubuntu:22.10 as stage-server-build2

COPY ./packages/router/res /home/res
COPY --from=stage-client-build3 /home/dist /home/dist
COPY --from=stage-server-build1 /home/target/release/hikari-router /home/a
WORKDIR /home
ENTRYPOINT [ "./a" ]
EXPOSE 80

# Preload dependencies,
# used to speed up repeated builds and reduce traffic consumption of libraries
FROM rust:latest as stage-deps

RUN rustup target add wasm32-unknown-unknown
RUN cargo install cargo-make
RUN cargo install wasm-bindgen-cli@0.2.87

COPY ./Cargo.toml /home/Cargo.toml
RUN cargo new --lib --name hikari-database /home/packages/database
COPY ./packages/database/Cargo.toml /home/packages/database/Cargo.toml
RUN cargo new --name hikari-router /home/packages/router
COPY ./packages/router/Cargo.toml /home/packages/router/Cargo.toml
RUN cargo new --lib --name hikari-web /home/packages/web
COPY ./packages/web/Cargo.toml /home/packages/web/Cargo.toml
RUN cargo new --lib --name hikari-utils /home/packages/utils
COPY ./packages/utils/Cargo.toml /home/packages/utils/Cargo.toml

WORKDIR /home
RUN cargo fetch

COPY ./packages /home/packages

# Stage 1 for client build, used to compile wasm file
FROM stage-deps as stage-client-build1

WORKDIR /home
RUN cargo build --offline --package hikari-web --target wasm32-unknown-unknown --release

# Stage 2 for client build, used to process wasm file for browser platform
FROM stage-deps as stage-client-build2

COPY --from=stage-client-build1 /home/target/wasm32-unknown-unknown/release/hikari_web.wasm /home/a.wasm
WORKDIR /home
RUN wasm-bindgen\
  --out-dir /home/dist\
  --out-name a\
  --target no-modules\
  --no-typescript\
  --no-modules-global __wasm_vendor_entry\
  a.wasm

# Stage 1 for server build, used to compile server program
FROM stage-deps as stage-server-build1

WORKDIR /home
RUN cargo build --offline --package hikari-router --release

# Stage 2 for server build, used to integrate the build result of client and generate the final image
FROM ubuntu:22.10 as stage-server-build2

COPY ./packages/router/res /home/dist/res
COPY --from=stage-client-build2 /home/dist/a_bg.wasm /home/dist/res/a.wasm
COPY --from=stage-client-build2 /home/dist/a.js /home/dist/res/a.js
COPY --from=stage-server-build1 /home/target/release/router /home/dist/a
ENV ROOT_DIR=/home/dist/res
WORKDIR /home/dist
ENTRYPOINT [ "./a" ]
EXPOSE 80

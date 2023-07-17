# Preload dependencies,
# only prepare the necessary runtime, and the subsequent listening and building work is completely handed over to cargo-make
FROM rust:latest

RUN rustup target add wasm32-unknown-unknown
RUN cargo install cargo-make
RUN cargo install wasm-bindgen-cli@0.2.87

COPY ./Cargo.toml /home/Cargo.toml
COPY ./Makefile.toml /home/Makefile.toml

VOLUME ["/home/target", "/home/packages"]

ENV ROOT_DIR=/home/res
WORKDIR /home
ENTRYPOINT ["cargo", "make", "-p", "docker-inside", "dev-on-container-build"]
EXPOSE 80

# Hikari - Forum Engine based on Rust

> Still in progress

## Build the web server

```shell
# Build the app
cargo run --bin build-server

# Run the app
cargo run --bin run-server
```

## Build the web server on docker

```shell
docker build -t hikari -f ./tasks/web.dockerfile .
```

## Build the native client

```shell
# Build the app
cargo run --bin build-app

# Run the app
cargo run --bin run-app
```

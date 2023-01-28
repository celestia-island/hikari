# Hikari - Forum Engine based on Rust

> Still in progress

## Build the web server

```shell
docker build -t hikari -f ./tasks/web.dockerfile .
```

## Build the native client

```shell
# On Windows NT
./tasks/app.ps1

# On Linux
./tasks/app.sh
```

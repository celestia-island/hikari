# Dependency Management and Version Conventions

This project establishes unified conventions for dependency formatting, grouping order, and version specifications in `Cargo.toml`. All crate maintenance and dependency additions must follow these guidelines.

## Dependency Grouping and Ordering

In `[dependencies]`, dependencies are grouped by function/semantics with blank line separators, and dependencies within each group are sorted alphabetically by crate name:

1. **Workspace dependencies**: Internal libraries within the workspace, such as `_utils`, `_client`, `_server`, etc. - crates starting with `_`.
2. **Basic language and tools**: Error handling and trait infrastructure, such as `anyhow`, `thiserror`, `async-trait`, `clap`, etc.
3. **Data and serialization**: Data structures, serialization, IDs, and time, such as `serde`, `serde_json`, `uuid`, `chrono`, `regex`, etc.
4. **Logging and tracing**: Logging and distributed tracing, such as `tracing`, `tracing-subscriber`, etc.
5. **Async / concurrency runtime**: Runtime and async utilities, such as `tokio` and related crates (`tokio-stream`, `tokio-tungstenite`, etc.).
6. **File system and paths**: Paths, directory traversal, and temporary files, such as `dirs`, `walkdir`, `tempfile`, etc.
7. **MCP / network and protocols**: MCP protocol stack and network-related libraries, such as `jsonrpc-core`, `axum`, `gloo-net`, `wasm-bindgen-futures`, `dioxus`, etc.

When adding new dependencies, place the crate in the group closest to its primary use; if there are multiple uses, prioritize the "semantically more core" category in the project context. For example:

- `axum` belongs to **MCP / network and protocols**;
- `gloo-net`, `wasm-bindgen-futures` belong to **MCP / network and protocols**;
- Dependencies used only in tests should be written in `[dev-dependencies]`, following the same grouping philosophy (strict segmentation is not required, but rough grouping by use is recommended).

## Version Number Writing Rules

All dependency versions uniformly use caret (`^`) semantic versioning, following these rules:

1. **When major version ≥ 1**

- Keep only the major version, written as `^<major>`.
- Examples:
- Actual version `4.1.3` → written as `^4`
- Actual version `2.0.0` → written as `^2`

1. **When major version is 0 and minor version ≥ 1**

- Major version is unstable but has a usable minor version; keep `0.<minor>`, written as `^0.<minor>`.
- Examples:
- Actual version `0.12.4` → written as `^0.12`
- Actual version `0.3.0` → written as `^0.3`

1. **When version is still in 0.0.x stage**

- Indicates the crate is still in a very early stage with uncertain compatibility; use the exact minor version as a fixed value, using precise version or necessary patch constraints.
- Examples:
- Actual version `0.0.7` → written as `0.0.7`

1. **Dependencies with features**

- Following the above version rules, add the `features` field:
- Examples:

```toml
     anyhow = { version = "^1", features = ["backtrace"] }
     serde = { version = "^1", features = ["derive"] }
     uuid = { version = "^1", features = [
       "v4",
       "serde",
     ] }
     ```

## Current Dependency Style Example

Taking a certain `Cargo.toml` as an example, the organized dependency section is as follows (only structure and style are illustrated):

```toml
[dependencies]
# Workspace dependencies
_utils = { path = "../packages/utils", optional = true }

# Basic language and tools
anyhow = { version = "^1", features = ["backtrace"] }
async-trait = "^0.1"
clap = { version = "^4", features = ["derive"] }
thiserror = "^2"

# Data and serialization
serde = { version = "^1", features = ["derive"] }
serde_json = "^1"
uuid = { version = "^1", features = ["v7", "serde"] }
chrono = { version = "^0.4", features = ["serde"] }
regex = "^1"

# Logging and tracing
tracing = "^0.1"
tracing-subscriber = { version = "^0.3", features = ["env-filter"] }

# Async / concurrency runtime
tokio = { version = "^1", features = ["full"] }
tokio-process = "^0.2"
tokio-stream = "^0.1"
tokio-tungstenite = "^0.28"

# File system and paths
dirs = "^6"
walkdir = "^2.5"
tempfile = "^3.10"

# MCP / network and protocols
jsonrpc-core = "^18"
axum = { version = "^0.8", features = ["ws", "macros"] }
gloo-net = { version = "^0.6", features = ["websocket"] }
wasm-bindgen-futures = "^0.4"
dioxus = { version = "^0.7", features = ["web"] }
```

> Note: The focus of the above example is **grouping and version writing**; specific version numbers should be adjusted according to the latest stable version of actual dependencies, but should always comply with the above caret rules.

## Scope of Application

- This specification applies to dependency management for all crates in this project;
- When adding, upgrading, or reordering dependencies, please:

1. Place crates in appropriate positions by group;
2. Version numbers must follow caret rules;
3. Prioritize using unified feature combinations (such as `derive` for `serde`, `v4` + `serde` for `uuid`).

If you need to add special dependencies in a subproject (for example, only used in tests or experimental features), it is recommended to supplement local explanations in `docs/` under the corresponding crate, while keeping this specification in conflict.

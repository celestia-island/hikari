# hikari-render-service

Server-Side Rendering integration for Hikari applications using Axum.

## Overview

`hikari-render-service` provides:

- **SSR Plugin Builder** - Fluent API for configuring SSR behavior
- **Router Builder** - Easy Axum router creation with Dioxus integration
- **Static Asset Serving** - Production-ready file serving with caching
- **Type-Safe State Management** - Shared state across all handlers
- **Production-Ready** - Error handling, compression, security features

## Installation

Add to your `Cargo.toml`:

```toml
[dependencies]
hikari-render-service = "0.1.0"
axum = "0.8"
tokio = { version = "1", features = ["full"] }
```

## Quick Start

### Minimal Example

```rust
use hikari_render_service::HikariRenderServicePlugin;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Build the router
    let app = HikariRenderServicePlugin::new()
        .build()?;

    // Start the server
    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await?;
    axum::serve(listener, app).await?;
    Ok(())
}
```

### With API Routes

```rust
use axum::routing::get;
use hikari_render_service::HikariRenderServicePlugin;

async fn health() -> &'static str {
    "OK"
}

async fn version() -> &'static str {
    "1.0.0"
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let app = HikariRenderServicePlugin::new()
        .add_route("/api/health", get(health))
        .add_route("/api/version", get(version))
        .build()?;

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await?;
    axum::serve(listener, app).await?;
    Ok(())
}
```

### With Static Assets

```rust
use hikari_render_service::HikariRenderServicePlugin;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let app = HikariRenderServicePlugin::new()
        .static_assets("./dist")  // Serve frontend files
        .add_route("/api/health", get(health))
        .build()?;

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await?;
    axum::serve(listener, app).await?;
    Ok(())
}
```

## HikariRenderServicePlugin API

The `HikariRenderServicePlugin` provides a fluent builder API for configuring SSR.

### Builder Methods

#### `new()`

Creates a new SSR plugin builder with default configuration.

```rust
let plugin = HikariRenderServicePlugin::new();
```

#### `add_route(path, method_router)`

Adds a custom route to the router.

**Arguments:**
- `path: impl AsRef<str>` - URL path (must start with '/')
- `method_router: MethodRouter<AppState>` - Axum MethodRouter

```rust
use axum::routing::{get, post};

let plugin = HikariRenderServicePlugin::new()
    .add_route("/api/users", get(get_users))
    .add_route("/api/users", post(create_user))
    .add_route("/api/users/:id", get(get_user));
```

#### `static_assets(path)`

Sets the static assets directory path.

**Arguments:**
- `path: impl Into<String>` - Path to static assets directory

```rust
let plugin = HikariRenderServicePlugin::new()
    .static_assets("./dist");
```

#### `static_config(config)`

Configures static file serving options.

**Arguments:**
- `config: StaticFileConfig` - Configuration for caching and compression

```rust
use hikari_render_service::StaticFileConfig;

let config = StaticFileConfig::default()
    .cache_max_age(7200)  // 2 hours
    .no_compression();

let plugin = HikariRenderServicePlugin::new()
    .static_assets("./dist")
    .static_config(config);
```

#### `state(key, value)`

Adds a state value available to all handlers.

**Arguments:**
- `key: impl Into<String>` - State key identifier
- `value: impl Serialize` - State value (must be serializable)

```rust
let plugin = HikariRenderServicePlugin::new()
    .state("app_name", "My Hikari App")
    .state("version", "1.0.0")
    .state("debug", true);
```

#### `build()`

Builds the Axum Router with all configured routes and middleware.

**Returns:** `anyhow::Result<axum::Router<AppState>>`

```rust
let app = HikariRenderServicePlugin::new()
    .static_assets("./dist")
    .add_route("/api/health", get(health))
    .build()?;
```

## Static File Serving

### StaticFileConfig

Configuration for static file serving with caching and compression.

```rust
use hikari_render_service::StaticFileConfig;

let config = StaticFileConfig {
    cache_enabled: true,
    cache_max_age: 3600,      // 1 hour
    compression_enabled: true,
    mime_types: MimeTypes::default(),
};
```

### Builder Methods

#### `default()`

Creates config with defaults:
- Cache enabled: 1 hour max-age
- Compression enabled
- Standard MIME types

```rust
let config = StaticFileConfig::default();
```

#### `no_cache()`

Disables caching for files.

```rust
let config = StaticFileConfig::default().no_cache();
```

#### `cache_max_age(seconds)`

Sets custom cache max-age in seconds.

```rust
let config = StaticFileConfig::default()
    .cache_max_age(7200);  // 2 hours
```

#### `no_compression()`

Disables compression.

```rust
let config = StaticFileConfig::default().no_compression();
```

### MIME Type Support

Built-in support for common file types:

- HTML: `text/html; charset=utf-8`
- CSS: `text/css; charset=utf-8`
- JavaScript: `application/javascript; charset=utf-8`
- WASM: `application/wasm`
- JSON: `application/json; charset=utf-8`
- Images: PNG, JPEG, SVG, ICO
- Fonts: WOFF, WOFF2, TTF, EOT
- Documents: PDF, TXT, XML

## Complete Example

### Full-Featured SSR Application

```rust
use axum::{
    extract::State,
    routing::{get, post},
    Json,
};
use hikari_render_service::{HikariRenderServicePlugin, StaticFileConfig};
use serde_json::Value;

// Health check handler
async fn health() -> &'static str {
    "OK"
}

// API handler with state
async fn get_user(
    State(state): State<serde_json::Value>,
) -> Result<Json<Value>, axum::http::StatusCode> {
    Ok(Json(json!({
        "user": "Alice",
        "app": state["app_name"]
    })))
}

// Main entry point
#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Configure static files with custom settings
    let static_config = StaticFileConfig::default()
        .cache_max_age(7200)  // 2 hours
        .compression_enabled(true);

    // Build the router
    let app = HikariRenderServicePlugin::new()
        // Add API routes
        .add_route("/api/health", get(health))
        .add_route("/api/user", get(get_user))
        // Serve static files
        .static_assets("./dist")
        .static_config(static_config)
        // Add application state
        .state("app_name", "Hikari Render Service App")
        .state("version", "1.0.0")
        .state("environment", "production")
        // Build router
        .build()?;

    // Start server
    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await?;
    println!("Server listening on http://0.0.0.0:3000");
    axum::serve(listener, app).await?;

    Ok(())
}
```

## API Routes

### GET Routes

```rust
async fn get_items() -> Json<Vec<Item>> {
    Json(vec![
        Item { id: 1, name: "Item 1" },
        Item { id: 2, name: "Item 2" },
    ])
}

let app = HikariSsrPlugin::new()
    .add_route("/api/items", get(get_items))
    .build()?;
```

### POST Routes

```rust
#[derive(Deserialize)]
struct CreateUser {
    name: String,
    email: String,
}

async fn create_user(
    Json(payload): Json<CreateUser>,
) -> Json<Value> {
    Json(json!({
        "id": 123,
        "name": payload.name,
        "email": payload.email
    }))
}

let app = HikariSsrPlugin::new()
    .add_route("/api/users", post(create_user))
    .build()?;
```

### Path Parameters

```rust
async fn get_user(
    axum::extract::Path(id): axum::extract::Path<u32>,
) -> Json<Value> {
    Json(json!({ "id": id, "name": "User" }))
}

let app = HikariSsrPlugin::new()
    .add_route("/api/users/:id", get(get_user))
    .build()?;
```

### Query Parameters

```rust
async fn search(
    axum::extract::Query(params): axum::extract::Query<SearchParams>,
) -> Json<Value> {
    Json(json!({ "query": params.q }))
}

let app = HikariSsrPlugin::new()
    .add_route("/api/search", get(search))
    .build()?;
```

## State Management

### Accessing State in Handlers

```rust
async fn handler(
    State(state): State<serde_json::Value>,
) -> Json<Value> {
    Json(json!({
        "app": state["app_name"],
        "version": state["version"]
    }))
}
```

### Complex State Values

```rust
#[derive(Clone, Serialize)]
struct AppConfig {
    database_url: String,
    redis_url: String,
    max_connections: u32,
}

let config = AppConfig {
    database_url: "postgresql://...".to_string(),
    redis_url: "redis://...".to_string(),
    max_connections: 100,
};

let app = HikariSsrPlugin::new()
    .state("config", config)
    .build()?;
```

## Deployment

### Production Checklist

1. **Set appropriate cache headers:**
   ```rust
   StaticFileConfig::default()
       .cache_max_age(86400)  // 24 hours for production
   ```

2. **Enable compression:**
   ```rust
   StaticFileConfig::default()
       .compression_enabled(true)
   ```

3. **Use proper host binding:**
   ```rust
   let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await?;
   ```

4. **Add logging:**
   ```rust
   tracing_subscriber::init();
   ```

### Docker Example

```dockerfile
FROM rust:1.75 as builder
WORKDIR /app
COPY . .
RUN cargo build --release

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates
COPY --from=builder /app/target/release/hikari-ssr-app /app/
EXPOSE 3000
CMD ["/app/hikari-ssr-app"]
```

### Environment Variables

```rust
use std::env;

let port = env::var("PORT")
    .unwrap_or_else(|_| "3000".to_string());

let static_path = env::var("STATIC_PATH")
    .unwrap_or_else(|_| "./dist".to_string());

let app = HikariSsrPlugin::new()
    .static_assets(static_path)
    .build()?;

let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{}", port)).await?;
```

## Error Handling

### Custom Error Responses

```rust
use axum::http::StatusCode;

async fn handler() -> Result<Json<Value>, StatusCode> {
    Err(StatusCode::NOT_FOUND)
}

async fn handler_with_message() -> Result<Json<Value>, (StatusCode, String)> {
    Err((StatusCode::BAD_REQUEST, "Invalid input".to_string()))
}
```

### Global Error Handling

```rust
use axum::error_handling::HandlerExt;

let app = HikariSsrPlugin::new()
    .build()?
    .handle_error(|error| async move {
        (StatusCode::INTERNAL_SERVER_ERROR, error.to_string())
    });
```

## Architecture

The SSR integration consists of:

1. **Plugin Layer** (`plugin.rs`): Builder API for configuration
2. **Router Layer** (`router.rs`): Axum router construction
3. **Static Files** (`static_files.rs`): Asset serving with caching
4. **Example** (`example.rs`): Complete working example

## Testing

### Unit Tests

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_plugin_creation() {
        let plugin = HikariSsrPlugin::new();
        assert_eq!(plugin.route_count(), 0);
        assert!(!plugin.has_static_assets());
    }

    #[tokio::test]
    async fn test_add_route() {
        async fn handler() -> &'static str {
            "OK"
        }

        let plugin = HikariSsrPlugin::new()
            .add_route("/test", get(handler));

        assert_eq!(plugin.route_count(), 1);
    }
}
```

## API Reference

### HikariSsrPlugin

Main builder for SSR configuration.

**Methods:**
- `new() -> Self` - Create new builder
- `add_route(path, router) -> Self` - Add route
- `static_assets(path) -> Self` - Set static files path
- `static_config(config) -> Self` - Configure static serving
- `state(key, value) -> Self` - Add state value
- `build() -> Result<Router>` - Build router

### StaticFileConfig

Configuration for static file serving.

**Fields:**
- `cache_enabled: bool` - Enable browser caching
- `cache_max_age: u64` - Cache-Control max-age in seconds
- `compression_enabled: bool` - Enable gzip compression
- `mime_types: MimeTypes` - MIME type mappings

## Examples

See the [examples](../../examples/) directory:
- `ssr-demo/` - Complete SSR application example

## License

MIT OR Apache-2.0

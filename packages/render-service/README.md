# hikari-render-service

Server-side rendering (SSR) and static asset serving for Hikari applications using Axum.

## Installation

```toml
[dependencies]
hikari-render-service = "0.1.0"
axum = "0.8"
tokio = { version = "1", features = ["full"] }
```

## Quick Start

```rust
use hikari_render_service::HikariRenderServicePlugin;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let app = HikariRenderServicePlugin::new()
        .build()?;

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await?;
    axum::serve(listener, app).await?;
    Ok(())
}
```

## Documentation

For complete API documentation, routing configuration, and static asset serving, see [docs.rs](https://docs.rs/hikari-render-service)

## Features

- **SSR Plugin Builder** - Fluent API for configuring SSR behavior
- **Router Builder** - Easy Axum router creation with Dioxus integration
- **Static Asset Serving** - Production-ready file serving with caching
- **Type-Safe State Management** - Shared state across all handlers
- **HTML Template Rendering** - Customizable HTML templates with style injection
- **Style Registry** - Centralized component style management

## Example Configuration

```rust
use axum::routing::get;
use hikari_render_service::HikariRenderServicePlugin;

async fn health() -> &'static str {
    "OK"
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let app = HikariRenderServicePlugin::new()
        .add_route("/api/health", get(health))
        .static_assets("./dist")
        .build()?;

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await?;
    axum::serve(listener, app).await?;
    Ok(())
}
```

## License

MIT OR Apache-2.0

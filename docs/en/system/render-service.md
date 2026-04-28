# Render-Service

Server-side rendering and static asset service.

## Overview

`hikari-render-service` provides:

- **HTML Rendering** - Custom HTML templates
- **Style Injection** - CSS variables and stylesheet injection
- **Router Building** - Type-safe router builder
- **Static Files** - Static asset service
- **Axum Integration** - Seamless Axum integration

## Core Modules

### 1. HTML Service

```rust
use hikari_render_service::html::HtmlService;

let html = HtmlService::new()
    .title("My App")
    .style("/styles/bundle.css")
    .body_content("<div id='main'></div>")
    .build();
```

### 2. Style Registry

```rust
use hikari_components::StyleRegistry;

let mut registry = StyleRegistry::default();
registry.register_available();
```

### 3. Router Builder

```rust
use hikari_render_service::router::RouterBuilder;

let router = RouterBuilder::new()
    .add_route("/", get(home_handler))
    .add_route("/api/health", get(health_handler))
    .build();
```

### 4. Static File Service

```rust
use hikari_render_service::HikariRenderServicePlugin;

let app = HikariRenderServicePlugin::new()
    .static_assets("./dist", "/static")
    .icon_assets("./icons", "/static/icons")
    .build()?;
```

## HikariRenderServicePlugin

### Basic Usage

```rust
use hikari_render_service::HikariRenderServicePlugin;
use axum::routing::get;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let mut style_registry = StyleRegistry::default();
    style_registry.register_available();

    let app = HikariRenderServicePlugin::new()
        .component_style_registry(style_registry)
        .static_assets("./public", "/static")
        .add_route("/api/health", get(health_check))
        .build()?;

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await?;
    axum::serve(listener, app).await?;

    Ok(())
}

async fn health_check() -> &'static str {
    "OK"
}
```

### Configuration Options

```rust
let app = HikariRenderServicePlugin::new()
    .component_style_registry(registry)
    .html_template(html_template)
    .static_assets("./dist", "/static")
    .icon_assets("./icons", "/static/icons")
    .static_files_config(FileConfig::default().no_cache())
    .add_route("/api/*", get(api_handler))
    .build()?;
```

## Static File Mounting

### Single Directory

```rust
plugin.static_assets("./dist", "/static");
```

### Multiple Directories

```rust
plugin
    .static_assets("./dist", "/static")
    .icon_assets("./icons", "/static/icons")
    .static_assets("./styles", "/styles");
```

### Custom Configuration

```rust
use hikari_render_service::{StaticMountConfig, StaticFileConfig};

let mount_config = StaticMountConfig::new("./dist", "/static")
    .config(StaticFileConfig::default().no_cache());

plugin.mount_static(mount_config);
```

## API Reference

### HikariRenderServicePlugin

```rust
pub struct HikariRenderServicePlugin {
    // Configuration fields
}

impl HikariRenderServicePlugin {
    pub fn new() -> Self;
    pub fn component_style_registry(self, registry: StyleRegistry) -> Self;
    pub fn html_template(self, template: String) -> Self;
    pub fn static_assets(self, dir: &str, mount: &str) -> Self;
    pub fn icon_assets(self, dir: &str, mount: &str) -> Self;
    pub fn add_route(self, path: &str, handler: MethodRouter) -> Self;
    pub fn mount_static(self, config: StaticMountConfig) -> Self;
    pub fn build(self) -> Result<Router, Error>;
}
```

### StyleRegistry

```rust
pub struct StyleRegistry {
    // Style registry
}

impl StyleRegistry {
    pub fn new() -> Self;
    pub fn register(&mut self, name: &str, style: &str);
    pub fn register_available(&mut self);
    pub fn get_styles(&self) -> HashMap<String, String>;
}
```

## Integration with Other Systems

- **Components** - Component style registry
- **Theme** - Theme CSS variables
- **Builder** - Generated CSS bundle
- **Icons** - Icon static file service

## Related Systems

- [Components](../components/) - Component library
- [Theme](./theme.md) - CSS variables
- [Builder](./builder.md) - CSS compilation

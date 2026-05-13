# Static Asset Mounting Examples

## Basic Usage

### Default Static Assets Mount

```rust,no_run
use hikari_render_service::HikariRenderServicePlugin;

let plugin = HikariRenderServicePlugin::new()
    .static_assets("./dist", "/static")
    .build()
    .unwrap();
```

This serves files from `./dist` directory at URL path `/static`.

### Icon Assets Mount

```rust,no_run
use hikari_render_service::HikariRenderServicePlugin;

let plugin = HikariRenderServicePlugin::new()
    .icon_assets("./packages/icons/dist/lucide/icons", "/static/icons")
    .build()
    .unwrap();
```

This serves icon SVG files from `./packages/icons/dist/lucide/icons` at `/static/icons`.

## Advanced Usage

### Multiple Mount Points

```rust,no_run
use hikari_render_service::HikariRenderServicePlugin;

let plugin = HikariRenderServicePlugin::new()
    // Main static assets (HTML, CSS, WASM, JS)
    .static_assets("./dist", "/static")
    // Icon assets
    .icon_assets("./packages/icons/dist/lucide/icons", "/static/icons")
    // Tailwind CSS bundle
    .static_assets("./packages/theme/styles", "/styles")
    .build()
    .unwrap();
```

URL mappings:

- `./dist/index.html` → `http://localhost:3000/static/index.html`
- `./packages/icons/dist/lucide/icons/chevron-down.svg` → `http://localhost:3000/static/icons/chevron-down.svg`
- `./packages/theme/styles/tailwind-bundle.css` → `http://localhost:3000/styles/tailwind-bundle.css`

### Custom Mount Paths

```rust,no_run
use hikari_render_service::HikariRenderServicePlugin;

let plugin = HikariRenderServicePlugin::new()
    // Mount assets at /assets instead of /static
    .static_assets("./dist", "/assets")
    // Mount icons at /icons (root level)
    .icon_assets("./icons", "/icons")
    .build()
    .unwrap();
```

### Using StaticMountConfig Directly

For advanced configuration:

```rust,no_run
use hikari_render_service::{HikariRenderServicePlugin, StaticMountConfig, StaticFileConfig};

let mount_config = StaticMountConfig::new("./dist", "/static")
    .config(StaticFileConfig::default().no_cache());

let plugin = HikariRenderServicePlugin::new()
    .mount_static(mount_config)
    .build()
    .unwrap();
```

## Complete Example with Dioxus SSR

```rust,no_run
use hikari_render_service::HikariRenderServicePlugin;
use hikari_components::StyleRegistry;
use axum::routing::get;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Register component styles
    let mut style_registry = StyleRegistry::default();
    style_registry.register_available();

    // Build the render service
    let app = HikariRenderServicePlugin::new()
        // Component styles
        .component_style_registry(style_registry)
        // Static assets (HTML, CSS, WASM, JS)
        .static_assets("./examples/website/dist", "/static")
        // Icon assets (Lucide SVG files)
        .icon_assets("./packages/icons/dist/lucide/icons", "/static/icons")
        // Custom routes
        .add_route("/api/health", get(health_check))
        .build()?;

    // Start server
    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await?;
    axum::serve(listener, app).await?;

    Ok(())
}

async fn health_check() -> &'static str {
    "OK"
}
```

## File URL Mapping

| Local Path | URL Path | File |
| --------- | -------- | ---- |
| `./dist/index.html` | `/static/index.html` | HTML |
| `./dist/assets/app.js` | `/static/assets/app.js` | JavaScript |
| `./dist/assets/app_bg.wasm` | `/static/assets/app_bg.wasm` | WASM |
| `./dist/styles/bundle.css` | `/static/styles/bundle.css` | CSS |
| `./packages/icons/dist/lucide/icons/menu.svg` | `/static/icons/menu.svg` | Icon SVG |

## Client-Side Usage

### Loading Icons at Runtime

```rust,ignore
use hikari_icons::runtime;

// Load icon SVG at runtime
let svg = runtime::load_icon("chevron-down").await.unwrap();

// Use in component
rsx! {
    div {
        dangerous_inner_html: "{svg}",
        class: "icon"
    }
}
```

### HTML Template

```html
<!DOCTYPE html>
<html>
<head>
    <link rel="stylesheet" href="/static/styles/bundle.css">
</head>
<body>
    <div id="main"></div>
    <script type="module">
        import init from '/static/assets/website.js';
        await init('/static/assets/website_bg.wasm');
        // hydrate app...
    </script>
</body>
</html>
```

## Tips

1. **Path Traversal Protection**: All static mounts are protected against directory traversal attacks (e.g., `../../../etc/passwd`).

2. **MIME Types**: Correct MIME types are automatically detected for common file extensions (HTML, CSS, JS, WASM, SVG, etc.).

3. **Caching**: By default, static files are cached for 1 hour. Customize with `StaticFileConfig`.

4. **Multiple Mounts**: You can mount as many directories as needed at different URL paths.

5. **Order Matters**: Routes are processed in the order they are added. More specific routes should come first.

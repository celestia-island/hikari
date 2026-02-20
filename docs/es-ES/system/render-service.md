# Render-Service

Renderizado del lado del servidor y servicio de recursos estáticos.

## Descripción General

`hikari-render-service` proporciona:

- **Renderizado HTML** - Plantillas HTML personalizadas
- **Inyección de Estilos** - Inyección de variables CSS y hojas de estilo
- **Constructor de Router** - Constructor de router con seguridad de tipos
- **Archivos Estáticos** - Servicio de recursos estáticos
- **Integración Axum** - Integración perfecta con Axum

## Módulos Principales

### 1. Servicio HTML

```rust
use hikari_render_service::html::HtmlService;

let html = HtmlService::new()
    .title("Mi App")
    .style("/styles/bundle.css")
    .body_content("<div id='main'></div>")
    .build();
```

### 2. Registro de Estilos

```rust
use hikari_components::StyleRegistry;

let mut registry = StyleRegistry::default();
registry.register_available();
```

### 3. Constructor de Router

```rust
use hikari_render_service::router::RouterBuilder;

let router = RouterBuilder::new()
    .add_route("/", get(home_handler))
    .add_route("/api/health", get(health_handler))
    .build();
```

### 4. Servicio de Archivos Estáticos

```rust
use hikari_render_service::HikariRenderServicePlugin;

let app = HikariRenderServicePlugin::new()
    .static_assets("./dist", "/static")
    .icon_assets("./icons", "/static/icons")
    .build()?;
```

## HikariRenderServicePlugin

### Uso Básico

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

### Opciones de Configuración

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

## Montaje de Archivos Estáticos

### Directorio Único

```rust
plugin.static_assets("./dist", "/static");
```

### Múltiples Directorios

```rust
plugin
    .static_assets("./dist", "/static")
    .icon_assets("./icons", "/static/icons")
    .static_assets("./styles", "/styles");
```

### Configuración Personalizada

```rust
use hikari_render_service::{StaticMountConfig, StaticFileConfig};

let mount_config = StaticMountConfig::new("./dist", "/static")
    .config(StaticFileConfig::default().no_cache());

plugin.mount_static(mount_config);
```

## Referencia de API

### HikariRenderServicePlugin

```rust
pub struct HikariRenderServicePlugin {
    // Campos de configuración
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
    // Registro de estilos
}

impl StyleRegistry {
    pub fn new() -> Self;
    pub fn register(&mut self, name: &str, style: &str);
    pub fn register_available(&mut self);
    pub fn get_styles(&self) -> HashMap<String, String>;
}
```

## Integración con Otros Sistemas

- **Componentes** - Registro de estilos de componentes
- **Tema** - Variables CSS de tema
- **Builder** - Paquete CSS generado
- **Iconos** - Servicio de archivos estáticos de iconos

## Sistemas Relacionados

- [Componentes](../components/) - Biblioteca de componentes
- [Tema](./theme.md) - Variables CSS
- [Builder](./builder.md) - Compilación CSS

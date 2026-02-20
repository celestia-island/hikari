# Render-Service

Rendu côté serveur et service de ressources statiques.

## Aperçu

`hikari-render-service` fournit :

- **Rendu HTML** - Templates HTML personnalisés
- **Injection de styles** - Variables CSS et injection de feuilles de style
- **Construction de routeur** - Constructeur de routeur avec sécurité de type
- **Fichiers statiques** - Service de ressources statiques
- **Intégration Axum** - Intégration transparente avec Axum

## Modules principaux

### 1. Service HTML

```rust
use hikari_render_service::html::HtmlService;

let html = HtmlService::new()
    .title("Mon Application")
    .style("/styles/bundle.css")
    .body_content("<div id='main'></div>")
    .build();
```

### 2. Registre de styles

```rust
use hikari_components::StyleRegistry;

let mut registry = StyleRegistry::default();
registry.register_available();
```

### 3. Constructeur de routeur

```rust
use hikari_render_service::router::RouterBuilder;

let router = RouterBuilder::new()
    .add_route("/", get(home_handler))
    .add_route("/api/health", get(health_handler))
    .build();
```

### 4. Service de fichiers statiques

```rust
use hikari_render_service::HikariRenderServicePlugin;

let app = HikariRenderServicePlugin::new()
    .static_assets("./dist", "/static")
    .icon_assets("./icons", "/static/icons")
    .build()?;
```

## HikariRenderServicePlugin

### Utilisation de base

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

### Options de configuration

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

## Montage de fichiers statiques

### Répertoire unique

```rust
plugin.static_assets("./dist", "/static");
```

### Répertoires multiples

```rust
plugin
    .static_assets("./dist", "/static")
    .icon_assets("./icons", "/static/icons")
    .static_assets("./styles", "/styles");
```

### Configuration personnalisée

```rust
use hikari_render_service::{StaticMountConfig, StaticFileConfig};

let mount_config = StaticMountConfig::new("./dist", "/static")
    .config(StaticFileConfig::default().no_cache());

plugin.mount_static(mount_config);
```

## Référence API

### HikariRenderServicePlugin

```rust
pub struct HikariRenderServicePlugin {
    // Champs de configuration
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
    // Registre de styles
}

impl StyleRegistry {
    pub fn new() -> Self;
    pub fn register(&mut self, name: &str, style: &str);
    pub fn register_available(&mut self);
    pub fn get_styles(&self) -> HashMap<String, String>;
}
```

## Intégration avec d'autres systèmes

- **Composants** - Registre de styles de composants
- **Thème** - Variables CSS de thème
- **Builder** - Bundle CSS généré
- **Icônes** - Service de fichiers d'icônes statiques

## Systèmes liés

- [Composants](../components/) - Bibliothèque de composants
- [Thème](./theme.md) - Variables CSS
- [Builder](./builder.md) - Compilation CSS

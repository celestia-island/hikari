# Render-Service

Серверный рендеринг и сервис статических ресурсов.

## Обзор

`hikari-render-service` предоставляет:

- **HTML-рендеринг** - Пользовательские HTML-шаблоны
- **Инъекция стилей** - CSS-переменные и инъекция таблиц стилей
- **Построитель роутера** - Типобезопасный сборщик роутера
- **Статические файлы** - Сервис статических ресурсов
- **Интеграция с Axum** - Бесшовная интеграция с Axum

## Основные модули

### 1. HTML Service

```rust
use hikari_render_service::html::HtmlService;

let html = HtmlService::new()
    .title("Моё приложение")
    .style("/styles/bundle.css")
    .body_content("<div id='main'></div>")
    .build();
```

### 2. Реестр стилей

```rust
use hikari_components::StyleRegistry;

let mut registry = StyleRegistry::default();
registry.register_available();
```

### 3. Построитель роутера

```rust
use hikari_render_service::router::RouterBuilder;

let router = RouterBuilder::new()
    .add_route("/", get(home_handler))
    .add_route("/api/health", get(health_handler))
    .build();
```

### 4. Сервис статических файлов

```rust
use hikari_render_service::HikariRenderServicePlugin;

let app = HikariRenderServicePlugin::new()
    .static_assets("./dist", "/static")
    .icon_assets("./icons", "/static/icons")
    .build()?;
```

## HikariRenderServicePlugin

### Базовое использование

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

### Параметры конфигурации

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

## Монтирование статических файлов

### Одна директория

```rust
plugin.static_assets("./dist", "/static");
```

### Несколько директорий

```rust
plugin
    .static_assets("./dist", "/static")
    .icon_assets("./icons", "/static/icons")
    .static_assets("./styles", "/styles");
```

### Пользовательская конфигурация

```rust
use hikari_render_service::{StaticMountConfig, StaticFileConfig};

let mount_config = StaticMountConfig::new("./dist", "/static")
    .config(StaticFileConfig::default().no_cache());

plugin.mount_static(mount_config);
```

## Справочник API

### HikariRenderServicePlugin

```rust
pub struct HikariRenderServicePlugin {
    // Поля конфигурации
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
    // Реестр стилей
}

impl StyleRegistry {
    pub fn new() -> Self;
    pub fn register(&mut self, name: &str, style: &str);
    pub fn register_available(&mut self);
    pub fn get_styles(&self) -> HashMap<String, String>;
}
```

## Интеграция с другими системами

- **Компоненты** - Реестр стилей компонентов
- **Тема** - CSS-переменные темы
- **Builder** - Сгенерированный CSS-бандл
- **Icons** - Сервис статических файлов иконок

## Связанные системы

- [Компоненты](../components/) - Библиотека компонентов
- [Тема](./theme.md) - CSS-переменные
- [Builder](./builder.md) - Компиляция CSS

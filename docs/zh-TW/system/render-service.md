# Render-Service 渲染服務

伺服器端渲染和靜態資源服務。

## 概述

`hikari-render-service` 提供：

- **HTML 渲染** - 自訂 HTML 模板
- **樣式注入** - CSS 變數和樣式表注入
- **路由構建** - 型別安全的路由構建器
- **靜態檔案** - 靜態資源服務
- **Axum 整合** - 與 Axum 完美整合

## 核心模組

### 1. HTML 服務

```rust
use hikari_render_service::html::HtmlService;

let html = HtmlService::new()
    .title("My App")
    .style("/styles/bundle.css")
    .body_content("<div id='main'></div>")
    .build();
```

### 2. 樣式註冊表

```rust
use hikari_components::StyleRegistry;

let mut registry = StyleRegistry::default();
registry.register_available();
```

### 3. 路由構建器

```rust
use hikari_render_service::router::RouterBuilder;

let router = RouterBuilder::new()
    .add_route("/", get(home_handler))
    .add_route("/api/health", get(health_handler))
    .build();
```

### 4. 靜態檔案服務

```rust
use hikari_render_service::HikariRenderServicePlugin;

let app = HikariRenderServicePlugin::new()
    .static_assets("./dist", "/static")
    .icon_assets("./icons", "/static/icons")
    .build()?;
```

## HikariRenderServicePlugin

### 基礎用法

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

### 配置選項

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

## 靜態檔案掛載

### 單一目錄

```rust
plugin.static_assets("./dist", "/static");
```

### 多個目錄

```rust
plugin
    .static_assets("./dist", "/static")
    .icon_assets("./icons", "/static/icons")
    .static_assets("./styles", "/styles");
```

### 自訂配置

```rust
use hikari_render_service::{StaticMountConfig, StaticFileConfig};

let mount_config = StaticMountConfig::new("./dist", "/static")
    .config(StaticFileConfig::default().no_cache());

plugin.mount_static(mount_config);
```

## API 參考

### HikariRenderServicePlugin

```rust
pub struct HikariRenderServicePlugin {
    // 配置欄位
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
    // 樣式註冊表
}

impl StyleRegistry {
    pub fn new() -> Self;
    pub fn register(&mut self, name: &str, style: &str);
    pub fn register_available(&mut self);
    pub fn get_styles(&self) -> HashMap<String, String>;
}
```

## 與其他系統整合

- **Components** - 元件樣式註冊表
- **Theme** - 主題 CSS 變數
- **Builder** - 生成的 CSS bundle
- **Icons** - 圖示靜態檔案服務

## 相關系統

- [Components 元件](../components/) - 元件庫
- [Theme 主題](./theme.md) - CSS 變數
- [Builder 構建系統](./builder.md) - CSS 編譯

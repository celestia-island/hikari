# خدمة العرض

العرض من جانب الخادم وخدمة الأصول الثابتة.

## نظرة عامة

توفر `hikari-render-service`:

- **عرض HTML** - قوالب HTML مخصصة
- **حقن النمط** - حقن متغيرات CSS وأوراق الأنماط
- **بناء المسارات** - منشئ مسارات آمن للنوع
- **الملفات الثابتة** - خدمة الأصول الثابتة
- **تكامل Axum** - تكامل سلس مع Axum

## الوحدات الأساسية

### 1. خدمة HTML

```rust
use hikari_render_service::html::HtmlService;

let html = HtmlService::new()
    .title("تطبيقي")
    .style("/styles/bundle.css")
    .body_content("<div id='main'></div>")
    .build();
```

### 2. سجل الأنماط

```rust
use hikari_components::StyleRegistry;

let mut registry = StyleRegistry::default();
registry.register_available();
```

### 3. منشئ المسارات

```rust
use hikari_render_service::router::RouterBuilder;

let router = RouterBuilder::new()
    .add_route("/", get(home_handler))
    .add_route("/api/health", get(health_handler))
    .build();
```

### 4. خدمة الملفات الثابتة

```rust
use hikari_render_service::HikariRenderServicePlugin;

let app = HikariRenderServicePlugin::new()
    .static_assets("./dist", "/static")
    .icon_assets("./icons", "/static/icons")
    .build()?;
```

## HikariRenderServicePlugin

### الاستخدام الأساسي

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

### خيارات التكوين

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

## تركيب الملفات الثابتة

### دليل واحد

```rust
plugin.static_assets("./dist", "/static");
```

### أدلة متعددة

```rust
plugin
    .static_assets("./dist", "/static")
    .icon_assets("./icons", "/static/icons")
    .static_assets("./styles", "/styles");
```

### تكوين مخصص

```rust
use hikari_render_service::{StaticMountConfig, StaticFileConfig};

let mount_config = StaticMountConfig::new("./dist", "/static")
    .config(StaticFileConfig::default().no_cache());

plugin.mount_static(mount_config);
```

## مرجع واجهة البرمجة

### HikariRenderServicePlugin

```rust
pub struct HikariRenderServicePlugin {
    // حقول التكوين
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
    // سجل الأنماط
}

impl StyleRegistry {
    pub fn new() -> Self;
    pub fn register(&mut self, name: &str, style: &str);
    pub fn register_available(&mut self);
    pub fn get_styles(&self) -> HashMap<String, String>;
}
```

## التكامل مع الأنظمة الأخرى

- **المكونات** - سجل أنماط المكونات
- **السمة** - متغيرات CSS للسمة
- **البناء** - حزمة CSS المولدة
- **الأيقونات** - خدمة ملفات الأيقونات الثابتة

## الأنظمة ذات الصلة

- [المكونات](../components/) - مكتبة المكونات
- [السمة](./theme.md) - متغيرات CSS
- [البناء](./builder.md) - تجميع CSS

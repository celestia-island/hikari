# Render-Service

サーバーサイドレンダリングと静的アセットサービス。

## 概要

`hikari-render-service`は以下を提供します：

- **HTMLレンダリング** - カスタムHTMLテンプレート
- **スタイル注入** - CSS変数とスタイルシート注入
- **ルータービルダー** - タイプセーフなルータービルダー
- **静的ファイル** - 静的アセットサービス
- **Axum統合** - シームレスなAxum統合

## コアモジュール

### 1. HTMLサービス

```rust
use hikari_render_service::html::HtmlService;

let html = HtmlService::new()
    .title("マイアプリ")
    .style("/styles/bundle.css")
    .body_content("<div id='main'></div>")
    .build();
```

### 2. スタイルレジストリ

```rust
use hikari_components::StyleRegistry;

let mut registry = StyleRegistry::default();
registry.register_available();
```

### 3. ルータービルダー

```rust
use hikari_render_service::router::RouterBuilder;

let router = RouterBuilder::new()
    .add_route("/", get(home_handler))
    .add_route("/api/health", get(health_handler))
    .build();
```

### 4. 静的ファイルサービス

```rust
use hikari_render_service::HikariRenderServicePlugin;

let app = HikariRenderServicePlugin::new()
    .static_assets("./dist", "/static")
    .icon_assets("./icons", "/static/icons")
    .build()?;
```

## HikariRenderServicePlugin

### 基本的な使い方

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

### 設定オプション

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

## 静的ファイルマウント

### 単一ディレクトリ

```rust
plugin.static_assets("./dist", "/static");
```

### 複数ディレクトリ

```rust
plugin
    .static_assets("./dist", "/static")
    .icon_assets("./icons", "/static/icons")
    .static_assets("./styles", "/styles");
```

### カスタム設定

```rust
use hikari_render_service::{StaticMountConfig, StaticFileConfig};

let mount_config = StaticMountConfig::new("./dist", "/static")
    .config(StaticFileConfig::default().no_cache());

plugin.mount_static(mount_config);
```

## APIリファレンス

### HikariRenderServicePlugin

```rust
pub struct HikariRenderServicePlugin {
    // 設定フィールド
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
    // スタイルレジストリ
}

impl StyleRegistry {
    pub fn new() -> Self;
    pub fn register(&mut self, name: &str, style: &str);
    pub fn register_available(&mut self);
    pub fn get_styles(&self) -> HashMap<String, String>;
}
```

## 他のシステムとの統合

- **コンポーネント** - コンポーネントスタイルレジストリ
- **テーマ** - テーマCSS変数
- **ビルダー** - 生成されたCSSバンドル
- **アイコン** - アイコン静的ファイルサービス

## 関連システム

- [コンポーネント](../components/) - コンポーネントライブラリ
- [テーマ](./theme.md) - CSS変数
- [ビルダー](./builder.md) - CSSコンパイル

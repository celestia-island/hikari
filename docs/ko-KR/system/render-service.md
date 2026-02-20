# Render-Service

서버 사이드 렌더링 및 정적 자산 서비스입니다.

## 개요

`hikari-render-service`가 제공하는 기능:

- **HTML 렌더링** - 커스텀 HTML 템플릿
- **스타일 주입** - CSS 변수 및 스타일시트 주입
- **라우터 빌딩** - 타입 안전 라우터 빌더
- **정적 파일** - 정적 자산 서비스
- **Axum 통합** - 원활한 Axum 통합

## 핵심 모듈

### 1. HTML 서비스

```rust
use hikari_render_service::html::HtmlService;

let html = HtmlService::new()
    .title("내 앱")
    .style("/styles/bundle.css")
    .body_content("<div id='main'></div>")
    .build();
```

### 2. Style 레지스트리

```rust
use hikari_components::StyleRegistry;

let mut registry = StyleRegistry::default();
registry.register_available();
```

### 3. 라우터 빌더

```rust
use hikari_render_service::router::RouterBuilder;

let router = RouterBuilder::new()
    .add_route("/", get(home_handler))
    .add_route("/api/health", get(health_handler))
    .build();
```

### 4. 정적 파일 서비스

```rust
use hikari_render_service::HikariRenderServicePlugin;

let app = HikariRenderServicePlugin::new()
    .static_assets("./dist", "/static")
    .icon_assets("./icons", "/static/icons")
    .build()?;
```

## HikariRenderServicePlugin

### 기본 사용법

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

### 구성 옵션

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

## 정적 파일 마운트

### 단일 디렉토리

```rust
plugin.static_assets("./dist", "/static");
```

### 여러 디렉토리

```rust
plugin
    .static_assets("./dist", "/static")
    .icon_assets("./icons", "/static/icons")
    .static_assets("./styles", "/styles");
```

### 커스텀 구성

```rust
use hikari_render_service::{StaticMountConfig, StaticFileConfig};

let mount_config = StaticMountConfig::new("./dist", "/static")
    .config(StaticFileConfig::default().no_cache());

plugin.mount_static(mount_config);
```

## API 참조

### HikariRenderServicePlugin

```rust
pub struct HikariRenderServicePlugin {
    // 구성 필드
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
    // 스타일 레지스트리
}

impl StyleRegistry {
    pub fn new() -> Self;
    pub fn register(&mut self, name: &str, style: &str);
    pub fn register_available(&mut self);
    pub fn get_styles(&self) -> HashMap<String, String>;
}
```

## 다른 시스템과의 통합

- **컴포넌트** - 컴포넌트 스타일 레지스트리
- **테마** - 테마 CSS 변수
- **Builder** - 생성된 CSS 번들
- **Icons** - 아이콘 정적 파일 서비스

## 관련 시스템

- [컴포넌트](../components/) - 컴포넌트 라이브러리
- [Theme](./theme.md) - CSS 변수
- [Builder](./builder.md) - CSS 컴파일

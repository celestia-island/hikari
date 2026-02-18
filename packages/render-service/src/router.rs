//! Router builder for Hikari render service applications.
//!
//! Combines Dioxus SSR routes, style service routes, custom routes, and static file serving
//! into a unified Axum router.

use std::{collections::HashMap, sync::Arc};

use axum::{
    Router,
    body::Body,
    extract::{Path, State},
    http::{StatusCode, Uri, header},
    response::{IntoResponse, Response},
    routing::any,
};
use thiserror::Error;
use tower_http::services::ServeDir;

use super::{
    plugin::{RouterRoute, StaticMountConfig},
    registry::StyleRegistry,
};

pub use super::icon_route::get_icon_data;

/// Application state shared across all handlers.
#[derive(Clone, Debug)]
pub struct AppState {
    pub config: HashMap<String, serde_json::Value>,
    pub style_registry: Option<Arc<StyleRegistry>>,
    pub tailwind_css: Option<&'static str>,
    pub public_dir: String,
}

impl AppState {
    pub fn new(config: HashMap<String, serde_json::Value>, public_dir: String) -> Self {
        Self {
            config,
            style_registry: None,
            tailwind_css: None,
            public_dir,
        }
    }

    pub fn with_style_registry(mut self, registry: StyleRegistry) -> Self {
        self.style_registry = Some(Arc::new(registry));
        self
    }

    pub fn with_tailwind_css(mut self, css: &'static str) -> Self {
        self.tailwind_css = Some(css);
        self
    }

    pub fn get<T>(&self, key: &str) -> Option<T>
    where
        T: for<'de> serde::Deserialize<'de>,
    {
        self.config
            .get(key)
            .and_then(|v| serde_json::from_value(v.clone()).ok())
    }
}

/// Errors that can occur during router construction.
#[derive(Error, Debug)]
pub enum RouterBuildError {
    #[error("Failed to build router: {0}")]
    BuildError(String),
}

/// Builds an Axum Router with Dioxus SSR and style service integration.
pub fn build_router(
    routes: Vec<RouterRoute>,
    static_mounts: Vec<StaticMountConfig>,
    state: HashMap<String, serde_json::Value>,
    style_registry: Option<StyleRegistry>,
    public_dir: Option<String>,
) -> anyhow::Result<Router> {
    let public_dir = public_dir.unwrap_or_else(|| "public".to_string());
    let mut app_state = AppState::new(state, public_dir);

    if let Some(registry) = style_registry {
        app_state = app_state.with_style_registry(registry);
    }

    let mut router = Router::new();

    for route in routes {
        router = router.route(&route.path, route.method_router);
    }

    if app_state.style_registry.is_some() {
        router = router.route(
            "/styles/registry/bundle.css",
            axum::routing::get(css_bundle_handler),
        );
        router = router.route(
            "/styles/components/<name>.css",
            axum::routing::get(component_css_handler),
        );
        router = router.route("/styles/info", axum::routing::get(style_info_handler));
    }

    router = router.route("/api/icons", axum::routing::get(get_icon_data));

    router = router.route(
        "/styles/tailwind.css",
        axum::routing::get(tailwind_css_handler),
    );

    router = router.route("/", axum::routing::get(index_handler));
    router = router.route("/index.html", axum::routing::get(index_handler));

    router = router.route("/ssr/<*path>", any(ssr_handler));
    router = router.route("/icons/<*path>", any(icon_fallback_handler));

    // Legacy route redirects - redirect old routes without language prefix to default language
    // These routes handle paths like /components, /system, /demos without language prefix
    router = router.route("/components", axum::routing::get(legacy_redirect_handler));
    router = router.route("/components/<*path>", axum::routing::get(legacy_redirect_handler));
    router = router.route("/system", axum::routing::get(legacy_redirect_handler));
    router = router.route("/system/<*path>", axum::routing::get(legacy_redirect_handler));
    router = router.route("/demos", axum::routing::get(legacy_redirect_handler));
    router = router.route("/demos/<*path>", axum::routing::get(legacy_redirect_handler));

    for mount_config in static_mounts {
        let serve_dir = ServeDir::new(&mount_config.local_path);
        router = router.nest_service(&mount_config.url_path, serve_dir);
    }

    router = router.fallback(axum::routing::get(spa_fallback_handler));

    let router = router.with_state(app_state);

    Ok(router)
}

/// Index handler - serves the SPA's index.html
async fn index_handler(State(state): State<AppState>) -> impl IntoResponse {
    let index_path = format!("{}/index.html", state.public_dir);
    let html = match tokio::fs::read_to_string(&index_path).await {
        Ok(content) => content,
        Err(e) => {
            eprintln!("❌ Failed to read public/index.html: {}", e);
            r#"<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Hikari App - Not Found</title>
    <style>
        body { font-family: system-ui; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
        .error { text-align: center; color: #f55; }
        .hint { color: #666; margin-top: 1rem; }
    </style>
</head>
<body>
    <div class="error">
        <h1>public/index.html not found</h1>
        <p class="hint">Run 'just build-client' or 'dx build' first.</p>
    </div>
</body>
</html>"#.to_string()
        }
    };

    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "text/html; charset=utf-8")
        .body(Body::from(html))
        .unwrap()
}

/// Legacy redirect handler - redirects old routes to language-prefixed routes
/// 
/// Converts:
/// - /components -> /zh-chs/components
/// - /components/layer1/button -> /zh-chs/components/layer1/button
/// - /system -> /zh-chs/system
/// - /demos -> /zh-chs/demos
async fn legacy_redirect_handler(uri: Uri) -> impl IntoResponse {
    let path = uri.path();
    let default_lang = "zh-chs";
    let new_path = format!("/{}{}", default_lang, path);
    
    Response::builder()
        .status(StatusCode::FOUND)
        .header(header::LOCATION, new_path)
        .header(header::CACHE_CONTROL, "no-cache")
        .body(Body::from(""))
        .unwrap()
}

/// Icon fallback handler - returns 404 for missing icon files
async fn icon_fallback_handler(Path(path): Path<String>) -> impl IntoResponse {
    let svg_404 = r#"<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke-linecap="round" stroke-linejoin="round"/>
</svg>"#;

    eprintln!("❌ Icon not found: /icons/{}", path);
    eprintln!("   Make sure MDI icons are downloaded: python scripts/icons/fetch_mdi_icons.py");
    eprintln!(
        "   Icon should be in: packages/builder/generated/mdi_svgs/{}.svg",
        path
    );

    Response::builder()
        .status(StatusCode::NOT_FOUND)
        .header(header::CONTENT_TYPE, "image/svg+xml; charset=utf-8")
        .header(header::CACHE_CONTROL, "no-cache, no-store, must-revalidate")
        .body(Body::from(svg_404))
        .unwrap()
}

/// SPA fallback handler - returns index.html for all unmatched routes
async fn spa_fallback_handler(_uri: Uri, State(state): State<AppState>) -> impl IntoResponse {
    let index_path = format!("{}/index.html", state.public_dir);
    let html = match tokio::fs::read_to_string(&index_path).await {
        Ok(content) => content,
        Err(_) => {
            r#"<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Hikari App - Not Found</title>
</head>
<body>
    <div style="font-family: system-ui; text-align: center; padding: 2rem;">
        <h1 style="color: #f55;">Application Not Built</h1>
        <p>public/index.html not found. Please build the application first.</p>
    </div>
</body>
</html>"#
                .to_string()
        }
    };

    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "text/html; charset=utf-8")
        .body(Body::from(html))
        .unwrap()
}

/// Dioxus SSR handler for server-side rendering.
async fn ssr_handler(uri: Uri, State(state): State<AppState>) -> impl IntoResponse {
    let index_path = format!("{}/index.html", state.public_dir);
    let html = match tokio::fs::read_to_string(&index_path).await {
        Ok(content) => content,
        Err(_) => {
            let path = uri.path();
            format!(
                r#"<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Hikari SSR</title>
</head>
<body>
    <div id="main">
        <h1>Hello from Hikari SSR!</h1>
        <p>Path: {}</p>
        <p><strong>Note:</strong> public/index.html not found. Run 'just build-client' first.</p>
    </div>
</body>
</html>"#,
                path
            )
        }
    };

    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "text/html; charset=utf-8")
        .body(Body::from(html))
        .unwrap()
}

/// Health check handler for monitoring and load balancers.
pub async fn health_check() -> impl IntoResponse {
    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(
            r#"{"status":"ok","service":"hikari-render-service"}"#,
        ))
        .unwrap()
}

/// 404 Not Found handler.
pub async fn not_found() -> impl IntoResponse {
    Response::builder()
        .status(StatusCode::NOT_FOUND)
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(
            r#"{"error":"Not Found","message":"The requested resource was not found"}"#,
        ))
        .unwrap()
}

/// 500 Internal Server Error handler.
pub async fn internal_error(err: String) -> impl IntoResponse {
    Response::builder()
        .status(StatusCode::INTERNAL_SERVER_ERROR)
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(format!(
            r#"{{"error":"Internal Server Error","message":"{}"}}"#,
            err
        )))
        .unwrap()
}

/// CSS bundle handler - serves all registered component styles as a single CSS bundle.
async fn css_bundle_handler(State(state): State<AppState>) -> impl IntoResponse {
    match &state.style_registry {
        Some(registry) => {
            let css = registry.css_bundle();
            Response::builder()
                .status(StatusCode::OK)
                .header(header::CONTENT_TYPE, "text/css; charset=utf-8")
                .header(header::CACHE_CONTROL, "public, max-age=3600")
                .body(Body::from(css))
                .unwrap()
        }
        None => {
            let empty = "/* No style registry configured */";
            Response::builder()
                .status(StatusCode::NOT_FOUND)
                .header(header::CONTENT_TYPE, "text/css; charset=utf-8")
                .body(Body::from(empty))
                .unwrap()
        }
    }
}

/// Component CSS handler - serves CSS for a single named component.
async fn component_css_handler(
    State(state): State<AppState>,
    Path(name): Path<String>,
) -> impl IntoResponse {
    let component_name = name.strip_suffix(".css").unwrap_or(&name);

    match &state.style_registry {
        Some(registry) => match registry.get(component_name) {
            Some(css) => Response::builder()
                .status(StatusCode::OK)
                .header(header::CONTENT_TYPE, "text/css; charset=utf-8")
                .header(header::CACHE_CONTROL, "public, max-age=3600")
                .body(Body::from(css.to_string()))
                .unwrap(),
            None => {
                let not_found = format!("/* Component '{}' not found */", component_name);
                Response::builder()
                    .status(StatusCode::NOT_FOUND)
                    .header(header::CONTENT_TYPE, "text/css; charset=utf-8")
                    .body(Body::from(not_found))
                    .unwrap()
            }
        },
        None => {
            let empty = "/* No style registry configured */";
            Response::builder()
                .status(StatusCode::NOT_FOUND)
                .header(header::CONTENT_TYPE, "text/css; charset=utf-8")
                .body(Body::from(empty))
                .unwrap()
        }
    }
}

/// Style info handler - returns JSON metadata about registered component styles.
async fn style_info_handler(State(state): State<AppState>) -> impl IntoResponse {
    use crate::models::{
        BasicComponents, ComponentCategories, DataComponents, DisplayComponents, EntryComponents,
        FeedbackComponents, NavigationComponents, StyleInfo,
    };

    let info = match &state.style_registry {
        Some(registry) => StyleInfo {
            total_components: registry.len(),
            components: ComponentCategories {
                basic: BasicComponents {
                    arrow: registry.has("arrow"),
                    background: registry.has("background"),
                    button: registry.has("button"),
                    input: registry.has("input"),
                    card: registry.has("card"),
                    badge: registry.has("badge"),
                    checkbox: registry.has("checkbox"),
                    radio_group: registry.has("radio_group"),
                    select: registry.has("select"),
                    switch: registry.has("switch"),
                    slider: registry.has("slider"),
                    textarea: registry.has("textarea"),
                    icon_button: registry.has("icon_button"),
                    divider: registry.has("divider"),
                    file_upload: registry.has("file_upload"),
                    form_field: registry.has("form_field"),
                    date_picker: registry.has("date_picker"),
                },
                data: DataComponents {
                    table: registry.has("table"),
                    tree: registry.has("tree"),
                    pagination: registry.has("pagination"),
                    pagination_button: registry.has("pagination_button"),
                    virtual_scroll: registry.has("virtual-scroll"),
                    collapse: registry.has("collapse"),
                    drag: registry.has("drag"),
                    sort: registry.has("sort"),
                    filter: registry.has("filter"),
                    selection: registry.has("selection"),
                },
                feedback: FeedbackComponents {
                    alert: registry.has("alert"),
                    toast: registry.has("toast"),
                    tooltip: registry.has("tooltip"),
                    modal: registry.has("modal"),
                    drawer: registry.has("drawer"),
                    dropdown: registry.has("dropdown"),
                    popover: registry.has("popover"),
                    progress: registry.has("progress"),
                    skeleton: registry.has("skeleton"),
                    spin: registry.has("spin"),
                },
                navigation: NavigationComponents {
                    menu: registry.has("menu"),
                    tabs: registry.has("tabs"),
                    breadcrumb: registry.has("breadcrumb"),
                    sidebar: registry.has("sidebar"),
                    steps: registry.has("steps"),
                },
                display: DisplayComponents {
                    tag: registry.has("tag"),
                    empty: registry.has("empty"),
                    comment: registry.has("comment"),
                    description_list: registry.has("description_list"),
                    qrcode: registry.has("qrcode"),
                },
                entry: EntryComponents {
                    number_input: registry.has("number_input"),
                    search: registry.has("search"),
                    auto_complete: registry.has("auto_complete"),
                    cascader: registry.has("cascader"),
                    transfer: registry.has("transfer"),
                },
            },
        },
        None => StyleInfo::empty(),
    };

    let json = serde_json::to_string_pretty(&info).unwrap_or_default();

    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "application/json; charset=utf-8")
        .body(Body::from(json))
        .unwrap()
}

/// Tailwind CSS handler - serves Tailwind CSS framework.
async fn tailwind_css_handler(State(state): State<AppState>) -> impl IntoResponse {
    match state.tailwind_css {
        Some(css) => Response::builder()
            .status(StatusCode::OK)
            .header(header::CONTENT_TYPE, "text/css; charset=utf-8")
            .header(header::CACHE_CONTROL, "public, max-age=3600")
            .body(Body::from(css))
            .unwrap(),
        None => {
            let not_found_css =
                "/* Tailwind CSS is not enabled. Make sure hikari-theme is properly built. */";
            Response::builder()
                .status(StatusCode::NOT_FOUND)
                .header(header::CONTENT_TYPE, "text/css; charset=utf-8")
                .body(Body::from(not_found_css))
                .unwrap()
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::routing::get;
    use std::collections::HashMap;

    #[tokio::test]
    async fn test_build_router_basic() {
        let router = build_router(vec![], vec![], HashMap::new(), None, None);

        assert!(router.is_ok());
    }

    #[tokio::test]
    async fn test_build_router_with_custom_route() {
        async fn custom_test_handler() -> &'static str {
            "OK"
        }

        let routes = vec![RouterRoute {
            path: "/test".to_string(),
            method_router: get(custom_test_handler),
        }];

        let router = build_router(routes, vec![], HashMap::new(), None, None);

        assert!(router.is_ok());
    }

    #[tokio::test]
    async fn test_build_router_with_static_assets() {
        let static_mounts = vec![StaticMountConfig::new("./dist", "/static")];
        let router = build_router(
            vec![],
            static_mounts,
            HashMap::new(),
            None,
            Some("public".to_string()),
        );

        assert!(router.is_ok());
    }

    #[tokio::test]
    async fn test_app_state_get() {
        let mut config = HashMap::new();
        config.insert(
            "app_name".to_string(),
            serde_json::Value::String("Test App".to_string()),
        );
        config.insert("version".to_string(), serde_json::Value::Number(1.into()));

        let state = AppState::new(config, "public".to_string());

        let app_name: Option<String> = state.get("app_name");
        assert_eq!(app_name, Some("Test App".to_string()));

        let version: Option<i32> = state.get("version");
        assert_eq!(version, Some(1));
    }

    #[tokio::test]
    async fn test_health_check() {
        let response = health_check().await.into_response();
        assert_eq!(response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn test_not_found() {
        let response = not_found().await.into_response();
        assert_eq!(response.status(), StatusCode::NOT_FOUND);
    }
}

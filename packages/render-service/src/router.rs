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

// Re-export icon route handler
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
///
/// # Arguments
///
/// * `routes` - Custom routes to add to the router
/// * `static_mounts` - Static asset mount configurations
/// * `state` - Application state to share across handlers
/// * `style_registry` - Optional style registry for CSS serving
///
/// # Example
///
/// ```rust,no_run
/// use render_service::router::build_router;
/// use render_service::StyleRegistry;
/// use std::collections::HashMap;
///
/// # async fn example() -> anyhow::Result<()> {
/// let registry = StyleRegistry::default();
/// let router = build_router(
///     vec![],
///     vec![],
///     HashMap::new(),
///     Some(registry),
/// )?;
/// # Ok(())
/// # }
/// ```
pub fn build_router(
    routes: Vec<RouterRoute>,
    static_mounts: Vec<StaticMountConfig>,
    state: HashMap<String, serde_json::Value>,
    style_registry: Option<StyleRegistry>,
    public_dir: Option<String>,
) -> anyhow::Result<Router> {
    // Create the application state
    let public_dir = public_dir.unwrap_or_else(|| "public".to_string());
    let mut app_state = AppState::new(state, public_dir);

    // Add style registry to state if provided
    if let Some(registry) = style_registry {
        app_state = app_state.with_style_registry(registry);
    }

    // Start building the router WITHOUT state first
    let mut router = Router::new();

    // Add custom routes first (before any typed nesting)
    for route in routes {
        router = router.route(&route.path, route.method_router);
    }

    // Style service routes: serve dynamic CSS from StyleRegistry
    // These routes complement the static bundle.css, providing per-component CSS
    // and style registry metadata via API endpoints
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

    // Add dynamic icon data endpoint
    router = router.route("/api/icons", axum::routing::get(get_icon_data));

    // Add Tailwind CSS route (always available if built)
    router = router.route(
        "/styles/tailwind.css",
        axum::routing::get(tailwind_css_handler),
    );

    // CRITICAL: Add root path handler BEFORE static mounts
    // This ensures the SPA index.html is served for the root path
    router = router.route("/", axum::routing::get(index_handler));
    router = router.route("/index.html", axum::routing::get(index_handler));

    // Add Dioxus SSR catch-all route
    router = router.route("/ssr/<*path>", any(ssr_handler));

    // Add icon fallback route for /icons/<path>
    // This ensures icon requests don't fall through to SPA fallback
    router = router.route("/icons/<*path>", any(icon_fallback_handler));

    // CRITICAL: Add static asset mounts with SPA fallback
    // Static files are served, but 404s fall through to index.html for SPA routing
    for mount_config in static_mounts {
        let serve_dir = ServeDir::new(&mount_config.local_path);
        router = router.nest_service(&mount_config.url_path, serve_dir);
    }

    // Add global fallback for any unmatched routes
    // This catches frontend routes like /components/basic, /system, etc.
    router = router.fallback(axum::routing::get(spa_fallback_handler));

    // NOW add state - this must be done last in Axum 0.8
    let router = router.with_state(app_state);

    // Note: Don't add TraceLayer here as it can cause issues with router serving
    // Users can add their own middleware layers after building the router

    Ok(router)
}

/// Index handler - serves the SPA's index.html
///
/// This is the entry point for the application. For Dioxus WASM apps,
/// the index.html contains everything needed to bootstrap the app.
async fn index_handler(State(state): State<AppState>) -> impl IntoResponse {
    // Try to read index.html from public directory
    let index_path = format!("{}/index.html", state.public_dir);
    let html = match tokio::fs::read_to_string(&index_path).await {
        Ok(content) => content,
        Err(e) => {
            // Fallback HTML if index.html not found
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

/// Icon fallback handler - returns 404 for missing icon files
///
/// This prevents icon requests from falling through to SPA fallback.
/// Icon files should be served from the mounted /icons directory.
/// If an icon is not found, return a clear 404 SVG instead of HTML.
async fn icon_fallback_handler(Path(path): Path<String>) -> impl IntoResponse {
    // Return a clear 404 SVG instead of HTML
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
///
/// This enables client-side routing by returning the same index.html
/// for all paths. The frontend router (Dioxus Router) will handle
/// displaying the correct page based on the URL.
async fn spa_fallback_handler(_uri: Uri, State(state): State<AppState>) -> impl IntoResponse {
    // For SPAs, all routes should return index.html
    // The frontend router handles showing the right page
    let index_path = format!("{}/index.html", state.public_dir);
    let html = match tokio::fs::read_to_string(&index_path).await {
        Ok(content) => content,
        Err(_) => {
            // Fallback HTML if index.html not found
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
///
/// This handler serves the Dioxus application with server-side rendering.
async fn ssr_handler(uri: Uri, State(state): State<AppState>) -> impl IntoResponse {
    // Try to read index.html from public directory
    let index_path = format!("{}/index.html", state.public_dir);
    let html = match tokio::fs::read_to_string(&index_path).await {
        Ok(content) => content,
        Err(_) => {
            // Fallback to default HTML if index.html not found
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
///
/// Returns a 200 OK response with basic health information.
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
///
/// Returns a JSON response for unmatched routes.
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
///
/// This provides the dynamically-registered component CSS from StyleRegistry,
/// complementing the static bundle.css served from public/styles/.
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
///
/// Endpoint: `/styles/components/<name>.css`
async fn component_css_handler(
    State(state): State<AppState>,
    Path(name): Path<String>,
) -> impl IntoResponse {
    // Strip .css extension if present
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
///
/// Endpoint: `/styles/info`
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

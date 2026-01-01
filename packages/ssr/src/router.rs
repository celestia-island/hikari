//! Router builder for Hikari SSR applications.
//!
//! Combines Dioxus SSR routes, custom routes, and static file serving
//! into a unified Axum router.

use super::plugin::RouterRoute;
use super::static_files::{serve_static_files, StaticFileConfig};
use axum::{
    body::Body,
    http::{header, StatusCode, Uri},
    response::{IntoResponse, Response},
    routing::any,
    Router,
};
use std::collections::HashMap;
use std::path::PathBuf;
use thiserror::Error;

/// Application state shared across all handlers.
#[derive(Clone, Debug)]
pub struct AppState {
    pub config: HashMap<String, serde_json::Value>,
}

impl AppState {
    pub fn new(config: HashMap<String, serde_json::Value>) -> Self {
        Self { config }
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

/// Builds an Axum Router with Dioxus SSR integration.
///
/// # Arguments
///
/// * `routes` - Custom routes to add to the router
/// * `static_assets_path` - Optional path to static assets directory
/// * `static_config` - Configuration for static file serving
/// * `state` - Application state to share across handlers
///
/// # Example
///
/// ```rust,no_run
/// use hikari_ssr::router::build_router;
/// use std::collections::HashMap;
///
/// # async fn example() -> anyhow::Result<()> {
/// let router = build_router(
///     vec![],
///     Some("./dist".into()),
///     Default::default(),
///     HashMap::new(),
/// )?;
/// # Ok(())
/// # }
/// ```
pub fn build_router(
    routes: Vec<RouterRoute>,
    static_assets_path: Option<PathBuf>,
    static_config: StaticFileConfig,
    state: HashMap<String, serde_json::Value>,
) -> anyhow::Result<Router> {
    // Create the application state
    let app_state = AppState::new(state);

    // Start building the router WITHOUT state first
    let mut router = Router::new();

    // Add custom routes
    for route in routes {
        router = router.route(&route.path, route.method_router);
    }

    // Add Dioxus SSR catch-all route
    router = router.route("/ssr/{*path}", any(ssr_handler));
    router = router.route("/", any(ssr_handler));

    // Add static assets route if configured
    if let Some(static_path) = static_assets_path {
        let config = static_config.clone();
        router = router.nest_service("/assets", serve_static_files(static_path, config));
    }

    // NOW add state - this must be done last in Axum 0.8
    let router = router.with_state(app_state);

    // Note: Don't add TraceLayer here as it can cause issues with router serving
    // Users can add their own middleware layers after building the router

    Ok(router)
}

/// Dioxus SSR handler for server-side rendering.
///
/// This handler serves the Dioxus application with server-side rendering.
async fn ssr_handler(uri: Uri) -> impl IntoResponse {
    // Get the path
    let path = uri.path();

    // For now, return a simple HTML response
    // In production, this would integrate with dioxus-fullstack
    let html = format!(
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
    </div>
</body>
</html>"#,
        path
    );

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
        .body(Body::from(r#"{"status":"ok","service":"hikari-ssr"}"#))
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

#[cfg(test)]
mod tests {
    use super::*;
    use axum::routing::get;
    use std::collections::HashMap;

    #[tokio::test]
    async fn test_build_router_basic() {
        let router = build_router(vec![], None, StaticFileConfig::default(), HashMap::new());

        assert!(router.is_ok());
    }

    #[tokio::test]
    async fn test_build_router_with_custom_route() {
        async fn test_handler() -> &'static str {
            "OK"
        }

        let routes = vec![RouterRoute {
            path: "/test".to_string(),
            method_router: get(test_handler),
        }];

        let router = build_router(routes, None, StaticFileConfig::default(), HashMap::new());

        assert!(router.is_ok());
    }

    #[tokio::test]
    async fn test_build_router_with_static_assets() {
        let router = build_router(
            vec![],
            Some("./dist".into()),
            StaticFileConfig::default(),
            HashMap::new(),
        );

        assert!(router.is_ok());
    }

    #[tokio::test]
    async fn test_app_state_get() {
        let mut config = HashMap::new();
        config.insert("app_name".to_string(), serde_json::json!("Test App"));
        config.insert("version".to_string(), serde_json::json!(1));

        let state = AppState::new(config);

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

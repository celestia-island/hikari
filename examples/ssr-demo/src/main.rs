// ssr-demo/src/main.rs
// Server-Side Rendering demo with Hikari SSR
//
// This is a complete, runnable SSR example that demonstrates:
// - Server setup with Axum
// - Static asset serving
// - Health check endpoints
// - Full-stack Dioxus integration
// - Production-ready error handling

use std::net::SocketAddr;
use axum::{
    extract::State,
    response::Json,
    routing::get,
};
use hikari_render_service::HikariRenderServicePlugin;
use serde_json::json;
use tokio::net::TcpListener;
use tower_http::{
    cors::CorsLayer,
    trace::TraceLayer,
};
use tracing::info;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

/// Health check handler
async fn health_check() -> Json<serde_json::Value> {
    Json(json!({
        "status": "healthy",
        "service": "hikari-ssr-demo",
        "timestamp": std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs(),
    }))
}

/// Detailed health check with system info
async fn health_detailed(State(state): State<hikari_render_service::router::AppState>) -> Json<serde_json::Value> {
    let name = state.config.get("name").and_then(|v| v.as_str()).unwrap_or("hikari-ssr-demo");
    let version = state.config.get("version").and_then(|v| v.as_str()).unwrap_or("0.1.0");

    Json(json!({
        "status": "healthy",
        "service": name,
        "version": version,
        "uptime": "running",
        "timestamp": std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs(),
    }))
}

/// API endpoint example
async fn api_info(State(state): State<hikari_render_service::router::AppState>) -> Json<serde_json::Value> {
    let name = state.config.get("name").and_then(|v| v.as_str()).unwrap_or("Hikari SSR Demo");
    let version = state.config.get("version").and_then(|v| v.as_str()).unwrap_or("0.1.0");

    Json(json!({
        "service": name,
        "version": version,
        "description": "Hikari SSR Demo - Server-Side Rendering with Dioxus",
        "features": [
            "Server-Side Rendering (SSR)",
            "Static asset serving",
            "Hot reloading in development",
            "Production-ready error handling",
            "Health check endpoints",
            "CORS support",
            "Request tracing"
        ]
    }))
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize tracing
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "hikari_render_service_demo=debug,tower_http=debug,axum=info".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    info!("Starting Hikari SSR Demo...");

    // Build the SSR router using HikariRenderServicePlugin
    let app = HikariRenderServicePlugin::new()
        // Add application state
        .state("name", "Hikari SSR Demo")
        .state("version", env!("CARGO_PKG_VERSION"))
        // Add custom API routes
        .add_route("/api/health", get(health_check))
        .add_route("/api/health/detailed", get(health_detailed))
        .add_route("/api/info", get(api_info))
        // Configure static assets
        .static_assets("./static")
        // Build the router
        .build()?;

    // Add middleware
    let app = app
        .layer(TraceLayer::new_for_http())
        .layer(CorsLayer::permissive());

    // Server configuration
    let addr = SocketAddr::from(([0, 0, 0, 0], 3000));
    info!("Server listening on http://{}", addr);
    info!("Health check: http://{}/api/health", addr);
    info!("API info: http://{}/api/info", addr);

    let listener = TcpListener::bind(addr).await?;

    // In Axum 0.8, serve with stateful router requires proper type handling
    // The router returned from build() already has state configured
    axum::serve(listener, app)
        .await
        .map_err(|e| anyhow::anyhow!("Server error: {}", e))?;

    Ok(())
}

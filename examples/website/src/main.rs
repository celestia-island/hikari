// website/src/main.rs
// Development server with Axum + WASM support

use std::net::SocketAddr;
use tokio::net::TcpListener;

use axum::response::IntoResponse;
use http::StatusCode;
use tower_http::cors::{Any, CorsLayer};

use _components::StyleRegistry;
use _render_service::{HikariRenderServicePlugin, plugin::StaticMountConfig, static_files::StaticFileConfig};

// Import centralized path configuration
use website::paths::STATIC_PATHS;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize tracing with more detailed logging
    tracing_subscriber::fmt()
        .with_max_level(tracing::Level::DEBUG)
        .with_target(false)
        .init();

    // 配置 CORS
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    // Create style registry and register all components
    let mut style_registry = StyleRegistry::default();
    style_registry.register_all();

    // Build router with HikariRenderServicePlugin
    let app = HikariRenderServicePlugin::new()
        .component_style_registry(style_registry)
        .add_route("/health", axum::routing::get(health_handler))
        .add_route("/_dioxus", axum::routing::get(dioxus_hmr_handler))
        .static_assets(STATIC_PATHS.assets_fs, STATIC_PATHS.assets_mount)
        // Disable cache for styles directory to force reload during development
        .mount_static(
            StaticMountConfig::new(STATIC_PATHS.styles_fs, STATIC_PATHS.styles_mount)
                .config(StaticFileConfig::default().no_cache()),
        )
        .static_assets(STATIC_PATHS.images_fs, STATIC_PATHS.images_mount)
        // Mount icons at /icons (not /static/icons) to match Icon component path
        // This ensures icon requests don't fall through to SPA fallback
        .icon_assets(STATIC_PATHS.icons_fs, "/icons")
        .build()?
        .layer(cors);

    // Start server
    let addr = SocketAddr::from(([127, 0, 0, 1], 3000));
    let listener = TcpListener::bind(addr).await?;

    tracing::info!("🚀 Hikari Website Server");
    tracing::info!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    tracing::info!("Server listening on http://{}", addr);
    tracing::info!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    axum::serve(listener, app).await?;

    Ok(())
}

/// Health check handler
async fn health_handler() -> impl IntoResponse {
    (StatusCode::OK, "OK")
}

/// Dioxus HMR handler - explicitly disable hot reload
async fn dioxus_hmr_handler() -> impl IntoResponse {
    (StatusCode::NOT_FOUND, "Hot reload is disabled")
}

// demo-app/src/main.rs
// Development server with Axum + WASM support

use hikari_components::StyleRegistry;
use hikari_render_service::HikariRenderServicePlugin;
use tower_http::{
    cors::Any,
    cors::CorsLayer,
};
use std::net::SocketAddr;
use tokio::net::TcpListener;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_max_level(tracing::Level::INFO)
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
        .add_route("/health", axum::routing::get(|| async { "OK" }))
        .static_assets("dist/assets")
        .build()?
        .layer(cors);

    // Start server
    let addr = SocketAddr::from(([127, 0, 0, 1], 3000));
    let listener = TcpListener::bind(addr).await?;

    tracing::info!("🚀 Hikari Demo App Server");
    tracing::info!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    tracing::info!("Server listening on http://{}", addr);
    tracing::info!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    axum::serve(listener, app).await?;

    Ok(())
}

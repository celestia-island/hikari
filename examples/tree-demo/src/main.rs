// tree-demo/src/main.rs
// Development server with Axum + WASM support

use std::net::SocketAddr;
use tokio::net::TcpListener;

use axum::{Router, http::StatusCode, response::{Html, IntoResponse}};
use tower_http::{cors::{Any, CorsLayer}, services::ServeDir};

/// SPA fallback handler - 返回 index.html 用于客户端路由
async fn spa_fallback() -> impl IntoResponse {
    match tokio::fs::read_to_string("dist/index.html").await {
        Ok(html) => Html(html).into_response(),
        Err(_) => (
            StatusCode::NOT_FOUND,
            "index.html not found. Run 'just build-client' first.",
        )
        .into_response(),
    }
}

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

    // Build router
    let app = Router::new()
        // Health check
        .route("/health", axum::routing::get(|| async { "OK" }))
        // 静态文件服务 (assets 包含 WASM, JS, CSS)
        .nest_service("/assets", ServeDir::new("dist/assets"))
        // SPA fallback - 所有其他路径返回 index.html
        .fallback(spa_fallback)
        .layer(cors);

    // Start server
    let addr = SocketAddr::from(([127, 0, 0, 1], 3000));
    let listener = TcpListener::bind(addr).await?;

    tracing::info!("🚀 Hikari Tree Demo Server");
    tracing::info!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    tracing::info!("Server listening on http://{}", addr);
    tracing::info!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    axum::serve(listener, app).await?;

    Ok(())
}

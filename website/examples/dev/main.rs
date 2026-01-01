mod pages;
mod r#static;

use anyhow::Result;
use log::info;
use std::net::SocketAddr;

use axum::{serve, Router};
use tokio::net::TcpListener;

#[tokio::main]
async fn main() -> Result<()> {
    env_logger::builder()
        .filter_level(log::LevelFilter::Info)
        .init();

    let port = std::env::var("PORT")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(8080);

    let router = Router::new()
        .nest("/", r#static::route().await?)
        .nest("/", pages::route().await?)
        .into_make_service_with_connect_info::<SocketAddr>();

    log::info!("Site will run on http://localhost:{port}");

    let listener = TcpListener::bind(format!("0.0.0.0:{port}"))
        .await
        .expect("Failed to bind");
    serve(listener, router).await?;

    Ok(())
}



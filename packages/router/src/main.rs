mod pages;

use log::info;
use std::future::Future;
use std::path::Path;

use axum::{
    http::StatusCode,
    response::IntoResponse,
    routing::{get, get_service},
    Router,
};
use hyper::server::Server;
use tower::ServiceBuilder;
use tower_http::{
    compression::CompressionLayer,
    services::{ServeDir, ServeFile},
    trace::TraceLayer,
};
use yew::platform::Runtime;

use crate::pages::render;
use hikari_database::functions::query_all_post;

async fn handle_static_file_error(err: std::io::Error) -> impl IntoResponse {
    (StatusCode::INTERNAL_SERVER_ERROR, err.to_string())
}

#[derive(Clone, Default)]
struct Executor {
    inner: Runtime,
}

impl<F> hyper::rt::Executor<F> for Executor
where
    F: Future + Send + 'static,
{
    fn execute(&self, fut: F) {
        self.inner.spawn_pinned(move || async move {
            fut.await;
        });
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    env_logger::Builder::new()
        .filter(None, log::LevelFilter::Info)
        .init();

    let port = std::env::var("PORT")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(80);
    let root_dir = std::env::var("ROOT_DIR")
        .ok()
        .and_then(|dir| Some(Path::new(&dir).to_path_buf()))
        .unwrap_or(std::env::current_dir()?.join("./target/web"));

    let db_conn = hikari_database::init(hikari_database::DatabaseConfig::MySQL({
        hikari_database::DatabaseNetworkConfig {
            host: std::env::var("DB_HOST").unwrap_or("localhost".into()),
            port: std::env::var("DB_PORT")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(3306),
            username: std::env::var("DB_USERNAME").unwrap_or("root".into()),
            password: std::env::var("DB_PASSWORD").unwrap_or("root".into()),
        }
    }))
    .await?;

    let middleware_stack = ServiceBuilder::new()
        .layer(TraceLayer::new_for_http())
        .layer(CompressionLayer::new())
        .into_inner();

    let app = Router::new()
        .route_service(
            "/res/entry/js",
            get_service(ServeFile::new(root_dir.clone().join("./a.js")))
                .handle_error(handle_static_file_error),
        )
        .route_service(
            "/res/entry/wasm",
            get_service(ServeFile::new(root_dir.clone().join("./a.wasm")))
                .handle_error(handle_static_file_error),
        )
        .route_service(
            "/logo.png",
            get_service(ServeFile::new(root_dir.clone().join("./logo.png")))
                .handle_error(handle_static_file_error),
        )
        .route_service(
            "/favicon.ico",
            get_service(ServeFile::new(root_dir.clone().join("./favicon.ico")))
                .handle_error(handle_static_file_error),
        )
        .route(
            "/timestamp",
            get(|| async { format!("{}", chrono::Utc::now().timestamp()) }),
        )
        .nest_service(
            "/res",
            get_service(ServeDir::new(root_dir.clone())).handle_error(handle_static_file_error),
        )
        .fallback(|req| async {
            render(req)
                .await
                .or_else(|err| Err((StatusCode::INTERNAL_SERVER_ERROR, err.to_string())))
        })
        .layer(middleware_stack);

    info!(r#"Root dir is "{}""#, root_dir.display());
    info!("Site will run on port {}", port);

    Server::bind(&format!("0.0.0.0:{}", port).parse()?)
        .executor(Executor::default())
        .serve(app.into_make_service())
        .await?;

    Ok(())
}

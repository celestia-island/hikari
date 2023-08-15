mod routes;

use log::info;
use std::future::Future;

use hyper::server::Server;
use tower::ServiceBuilder;
use tower_http::{compression::CompressionLayer, trace::TraceLayer};
use yew::platform::Runtime;

use crate::routes::route;

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

    hikari_database::init(hikari_database::DatabaseNetworkConfig {
        host: std::env::var("DB_HOST").unwrap_or("localhost".into()),
        port: std::env::var("DB_PORT")
            .ok()
            .and_then(|s| s.parse().ok())
            .unwrap_or(8000),
        username: std::env::var("DB_USERNAME").unwrap_or("root".into()),
        password: std::env::var("DB_PASSWORD").unwrap_or("root".into()),
        namespace: std::env::var("DB_NAMESPACE").unwrap_or("hikari".into()),
        database: std::env::var("DB_DATABASE").unwrap_or("hikari".into()),
    })
    .await?;

    let middleware_stack = ServiceBuilder::new()
        .layer(TraceLayer::new_for_http())
        .layer(CompressionLayer::new())
        .into_inner();

    let router = route().await?.layer(middleware_stack);

    info!("Site will run on port {}", port);

    Server::bind(&format!("0.0.0.0:{}", port).parse()?)
        .serve(router.into_make_service())
        .await?;

    Ok(())
}

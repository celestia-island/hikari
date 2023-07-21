use anyhow::Result;

use axum::{routing::get_service, Router};
use tower_http::services::ServeFile;

use super::super::ROOT_DIR;

pub async fn route() -> Result<Router> {
    let router = Router::new()
        .route_service(
            "/a.js",
            get_service(ServeFile::new(ROOT_DIR.clone().join("./a.js"))),
        )
        .route_service(
            "/a.wasm",
            get_service(ServeFile::new(ROOT_DIR.clone().join("./a.wasm"))),
        )
        .route_service(
            "/favicon.ico",
            get_service(ServeFile::new(ROOT_DIR.clone().join("./favicon.ico"))),
        )
        .route_service(
            "/logo.png",
            get_service(ServeFile::new(ROOT_DIR.clone().join("./logo.png"))),
        );

    Ok(router)
}

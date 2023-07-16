use anyhow::Result;

use axum::{response::IntoResponse, routing::get_service, Router};
use hyper::StatusCode;
use tower_http::services::ServeFile;

use super::super::ROOT_DIR;

async fn handle_static_file_error(err: std::io::Error) -> impl IntoResponse {
    (StatusCode::INTERNAL_SERVER_ERROR, err.to_string())
}

pub async fn route() -> Result<Router> {
    let router = Router::new()
        .route_service(
            "/a.js",
            get_service(ServeFile::new(ROOT_DIR.clone().join("./a.js")))
                .handle_error(handle_static_file_error),
        )
        .route_service(
            "/a.wasm",
            get_service(ServeFile::new(ROOT_DIR.clone().join("./a.wasm")))
                .handle_error(handle_static_file_error),
        );

    Ok(router)
}

pub mod component;
pub mod guide;
pub mod portal;

use anyhow::Result;

use axum::{
    extract::Path,
    http::{header, HeaderMap, StatusCode},
    routing::get,
    Router,
};

use crate::pages;

pub async fn route() -> Result<Router> {
    let router = Router::new()
        .route(
            "/",
            get(|| async {
                pages::portal::html()
                    .await
                    .map(|raw| {
                        let mut headers = HeaderMap::new();
                        headers.insert(header::CONTENT_TYPE, "text/html".parse().unwrap());

                        (headers, raw)
                    })
                    .map_err(|err| (StatusCode::INTERNAL_SERVER_ERROR, err.to_string()))
            }),
        )
        .route(
            "/guide/:id",
            get(move |Path(id): Path<String>| async move {
                pages::guide::html(id)
                    .await
                    .map(|raw| {
                        let mut headers = HeaderMap::new();
                        headers.insert(header::CONTENT_TYPE, "text/html".parse().unwrap());

                        (headers, raw)
                    })
                    .map_err(|err| (StatusCode::INTERNAL_SERVER_ERROR, err.to_string()))
            }),
        )
        .route(
            "/component/*id",
            get(move |Path(id): Path<String>| async move {
                pages::component::html(id)
                    .await
                    .map(|raw| {
                        let mut headers = HeaderMap::new();
                        headers.insert(header::CONTENT_TYPE, "text/html".parse().unwrap());

                        (headers, raw)
                    })
                    .map_err(|err| (StatusCode::INTERNAL_SERVER_ERROR, err.to_string()))
            }),
        );

    Ok(router)
}

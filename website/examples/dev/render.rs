use anyhow::Result;

use axum::{
    extract::Path,
    http::{header, HeaderMap, StatusCode},
    response::IntoResponse,
    routing::get,
    Router,
};

use hikari_boot::Application;
use hikari_website::app::App;

pub async fn html(url: String) -> Result<impl IntoResponse, (StatusCode, String)> {
    let raw = App::render_to_string(url, Default::default())
        .await
        .map_err(|err| (StatusCode::INTERNAL_SERVER_ERROR, err.to_string()))?;

    {
        let mut headers = HeaderMap::new();
        headers.insert(header::CONTENT_TYPE, "text/html".parse().unwrap());

        Ok((headers, raw))
    }
}

pub async fn route() -> Result<Router> {
    let router = Router::new()
        .route("/", get(|| async { html("/".to_string()).await }))
        .route(
            "/guide/:id",
            get(move |Path(id): Path<String>| async move { html(format!("/guide/{}", id)).await }),
        )
        .route(
            "/component/*id",
            get(move |Path(id): Path<String>| async move { html(format!("/component/{}", id)).await }),
        );

    Ok(router)
}

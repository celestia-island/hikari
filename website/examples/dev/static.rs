use anyhow::Result;

use axum::{
    http::{header, HeaderMap, StatusCode},
    response::IntoResponse,
    routing::get,
    Router,
};

pub async fn wasm() -> Result<impl IntoResponse, (StatusCode, String)> {
    {
        let mut headers = HeaderMap::new();
        headers.insert(header::CONTENT_TYPE, "application/wasm".parse().unwrap());

        Ok((
            headers,
            std::fs::read({
                let mut path = std::env::current_dir().unwrap();
                path.push("target/wasm32-html/a_bg.wasm");
                path
            })
            .map_err(|err| (StatusCode::INTERNAL_SERVER_ERROR, err.to_string()))?,
        ))
    }
}

pub async fn js() -> Result<impl IntoResponse, (StatusCode, String)> {
    {
        let mut headers = HeaderMap::new();
        headers.insert(header::CONTENT_TYPE, "text/javascript".parse().unwrap());

        Ok((
            headers,
            std::fs::read_to_string({
                let mut path = std::env::current_dir().unwrap();
                path.push("target/wasm32-html/a.js");
                path
            })
            .map_err(|err| (StatusCode::INTERNAL_SERVER_ERROR, err.to_string()))?,
        ))
    }
}

pub async fn route() -> Result<Router> {
    let router = Router::new()
        .route("/a.wasm", get(wasm))
        .route("/a.js", get(js));

    Ok(router)
}



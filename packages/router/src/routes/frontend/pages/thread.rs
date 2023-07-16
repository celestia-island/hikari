use anyhow::Result;
use log::info;

use axum::{body::Body, http::Request, response::IntoResponse};
use hyper::StatusCode;

use super::render;
use hikari_web::utils::contexts::app_props::AppPageProps;

pub async fn query(req: Request<Body>) -> Result<impl IntoResponse, (StatusCode, String)> {
    info!("Personal page entached.");
    render(
        req,
        AppPageProps::Thread {
            id: "test".into(),
            title: "Test".into(),
            content: "Hello".into(),
            comments: vec!["Hi".into(), "Hi there".into()],
        },
    )
    .await
    .or(Err((
        StatusCode::INTERNAL_SERVER_ERROR,
        "Failed to render page.".into(),
    )))
}

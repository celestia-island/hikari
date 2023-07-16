use anyhow::Result;
use log::info;

use axum::{body::Body, http::Request, response::IntoResponse};
use hyper::StatusCode;

use super::render;
use hikari_web::utils::contexts::app_props::{AppPageProps, Sex};

pub async fn query(req: Request<Body>) -> Result<impl IntoResponse, (StatusCode, String)> {
    info!("Personal page entached.");
    render(
        req,
        AppPageProps::Personal {
            id: "test".into(),
            name: "test".into(),
            email: "test".into(),
            sex: Sex::Female,
        },
    )
    .await
    .or(Err((
        StatusCode::INTERNAL_SERVER_ERROR,
        "Failed to render page.".into(),
    )))
}

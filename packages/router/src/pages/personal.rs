use log::info;

use axum::{body::Body, http::Request};

use hikari_web::utils::contexts::app_props::{AppPageProps, Sex};

pub async fn query_personal(
    req: &Request<Body>,
) -> Result<AppPageProps, Box<dyn std::error::Error>> {
    info!("Personal page entached.");
    Ok(AppPageProps::Personal {
        id: "test".into(),
        name: "test".into(),
        email: "test".into(),
        sex: Sex::Female,
    })
}

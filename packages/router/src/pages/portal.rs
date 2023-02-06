use log::info;

use axum::{body::Body, http::Request};

use hikari_web::utils::contexts::app_props::AppPageProps;

pub async fn query_portal(req: &Request<Body>) -> Result<AppPageProps, Box<dyn std::error::Error>> {
    info!("Portal page entached.");
    Ok(AppPageProps::Portal {
        id: "entry".into(),
        thread_list: vec![],
    })
}

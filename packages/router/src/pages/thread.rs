use log::info;

use axum::{body::Body, http::Request};

use hikari_web::utils::contexts::app_props::AppPageProps;

pub async fn query_thread(req: &Request<Body>) -> Result<AppPageProps, Box<dyn std::error::Error>> {
    info!("Thread page entached.");
    Ok(AppPageProps::Thread {
        id: "test".into(),
        title: "Test".into(),
        content: "Hello".into(),
        comments: vec!["Hi".into(), "Hi there".into()],
    })
}

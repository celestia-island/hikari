use anyhow::Result;

use axum::Router;

pub mod pages;
pub mod static_files;

pub async fn route() -> Result<Router> {
    let router = Router::new()
        .nest("/", static_files::route().await?)
        .nest("/", pages::route().await?);

    Ok(router)
}

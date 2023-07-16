use anyhow::Result;

use axum::Router;

pub mod pages;
pub mod static_files;

pub async fn route() -> Result<Router> {
    let router = Router::new()
        .nest("/", pages::route().await?)
        .nest("/", static_files::route().await?);

    Ok(router)
}

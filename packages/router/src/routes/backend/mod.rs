use anyhow::Result;

use axum::Router;

mod functions;
mod secure;

pub async fn route() -> Result<Router> {
    let router = Router::new()
        .nest("/", secure::route().await?)
        .nest("/", functions::route().await?);

    Ok(router)
}

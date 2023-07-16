use anyhow::Result;

use axum::Router;

mod users;

pub async fn route() -> Result<Router> {
    let router = Router::new().nest("/users", users::route().await?);

    Ok(router)
}

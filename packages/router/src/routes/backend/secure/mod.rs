use anyhow::Result;

use axum::{routing::post, Router};

mod login;
mod register;
mod verify;

use login::login;
use register::register;
use verify::verify;

pub async fn route() -> Result<Router> {
    let router = Router::new()
        .route("/login", post(login))
        .route("/verify", post(verify))
        .route("/register", post(register));

    Ok(router)
}

pub mod functions;
pub mod models;

use anyhow::Result;
use async_once::AsyncOnce;
use lazy_static::lazy_static;
use log::info;

use surrealdb::{
    engine::remote::ws::{Client, Ws},
    opt::auth::Root,
    Surreal,
};

pub struct DatabaseNetworkConfig {
    pub host: String,
    pub port: u16,
    pub username: String,
    pub password: String,
    pub namespace: String,
    pub database: String,
}

pub async fn init(config: DatabaseNetworkConfig) -> Result<()> {
    let db = DB_CONN.get().await;
    info!("Database is ready");

    db.signin(Root {
        username: config.username.as_str(),
        password: config.password.as_str(),
    })
    .await?;
    db.use_ns(config.namespace).use_db(config.database).await?;

    Ok(())
}

lazy_static! {
    static ref DB_CONN: AsyncOnce<Surreal<Client>> =
        AsyncOnce::new(async { Surreal::new::<Ws>("database:8000").await.unwrap() });
}

use anyhow::Result;
use lazy_static::lazy_static;
use log::info;
use std::path::{Path, PathBuf};

use axum::Router;

pub mod backend;
pub mod frontend;
pub(crate) mod utils;

pub async fn route() -> Result<Router> {
    let router = Router::new()
        .nest("/", frontend::route().await?)
        .nest("/api", backend::route().await?);

    Ok(router)
}

lazy_static! {
    static ref ROOT_DIR: PathBuf = {
        let root_dir = std::env::var("ROOT_DIR")
            .ok()
            .and_then(|dir| Some(Path::new(&dir).to_path_buf()))
            .unwrap_or(std::env::current_dir().unwrap().join("/home/res"));
        info!(r#"Root dir is "{}""#, root_dir.display());
        root_dir
    };
}

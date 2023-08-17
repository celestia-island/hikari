use anyhow::Result;

use crate::{models::user::Model, DB_CONN};

pub async fn list(from: u64, count: u64) -> Result<Vec<Model>> {
    let ret = DB_CONN
        .get()
        .await
        .select("user")
        .range(from..(from + count))
        .await?;
    Ok(ret)
}

use anyhow::Result;

use crate::{models::user::Model, DB_CONN};

pub async fn query(id: impl ToString) -> Result<Model> {
    let ret = DB_CONN.get().await.select(("user", id.to_string())).await?;
    Ok(ret)
}

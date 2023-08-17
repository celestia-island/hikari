use anyhow::Result;

use crate::{models::user::Model, DB_CONN};

pub async fn insert(item: Model) -> Result<()> {
    DB_CONN.get().await.create("user").content(item).await?;

    Ok(())
}

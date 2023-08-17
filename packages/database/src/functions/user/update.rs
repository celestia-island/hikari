use anyhow::Result;

use crate::{models::user::Model, DB_CONN};

pub async fn update(item: Model) -> Result<()> {
    DB_CONN
        .get()
        .await
        .update(("user", item.id.to_string()))
        .content(item)
        .await?;

    Ok(())
}

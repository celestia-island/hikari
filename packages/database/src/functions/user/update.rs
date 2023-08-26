use anyhow::Result;

use crate::{models::user::Model as PO, DB_CONN};
use hikari_utils::types::functions::user::Model as DTO;

pub async fn update(item: DTO) -> Result<()> {
    DB_CONN
        .get()
        .await
        .update(("user", item.id.to_string()))
        .content(PO::from(item))
        .await?;

    Ok(())
}

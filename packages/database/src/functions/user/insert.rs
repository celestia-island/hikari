use anyhow::Result;

use crate::{models::user::Model as PO, DB_CONN};
use hikari_utils::types::functions::user::Model as DTO;

pub async fn insert(item: DTO) -> Result<()> {
    DB_CONN
        .get()
        .await
        .create("user")
        .content(PO::from(item))
        .await?;

    Ok(())
}

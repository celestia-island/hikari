use anyhow::Result;

use crate::{models::user::Model as PO, DB_CONN};
use hikari_utils::types::functions::user::Model as DTO;

pub async fn query(id: impl ToString) -> Result<DTO> {
    let ret: PO = DB_CONN.get().await.select(("user", id.to_string())).await?;

    let ret: DTO = ret.into();
    Ok(ret)
}

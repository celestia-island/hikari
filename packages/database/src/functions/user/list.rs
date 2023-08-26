use anyhow::Result;

use crate::{models::user::Model as PO, DB_CONN};
use hikari_utils::types::functions::user::Model as DTO;

pub async fn list(from: u64, count: u64) -> Result<Vec<DTO>> {
    let ret: Vec<PO> = DB_CONN
        .get()
        .await
        .select("user")
        .range(from..(from + count))
        .await?;

    let ret: Vec<DTO> = ret.into_iter().map(|r| r.into()).collect();
    Ok(ret)
}

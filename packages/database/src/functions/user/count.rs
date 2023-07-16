use anyhow::Result;

use sea_orm::{EntityTrait, PaginatorTrait};

use crate::{models::user::Entity, DB_CONN};

pub async fn count() -> Result<u64> {
    Ok(Entity::find().count(DB_CONN.lock().await.get_mut()).await?)
}

use anyhow::Result;
use sea_orm::{EntityTrait, ModelTrait};
use uuid::Uuid;

use crate::{models::user::Entity, DB_CONN};

pub async fn delete(id: Uuid) -> Result<()> {
    if let Some(item) = Entity::find_by_id(id)
        .one(DB_CONN.lock().await.get_mut())
        .await?
    {
        item.delete(DB_CONN.lock().await.get_mut()).await?;
    }
    Ok(())
}

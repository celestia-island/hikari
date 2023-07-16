use anyhow::Result;
use sea_orm::EntityTrait;
use uuid::Uuid;

use crate::{
    models::user::{Entity, Model},
    DB_CONN,
};

pub async fn query(id: Uuid) -> Result<Model> {
    let ret = Entity::find_by_id(id)
        .one(DB_CONN.lock().await.get_mut())
        .await?
        .unwrap();
    Ok(ret)
}

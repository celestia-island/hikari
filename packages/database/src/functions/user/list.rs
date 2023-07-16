use anyhow::Result;

use sea_orm::{EntityTrait, QuerySelect};

use crate::{
    models::user::{Entity, Model},
    DB_CONN,
};

pub async fn list(from: u64, count: u64) -> Result<Vec<Model>> {
    let ret = Entity::find()
        .offset(from)
        .limit(count)
        .all(DB_CONN.lock().await.get_mut())
        .await?
        .to_vec();
    Ok(ret)
}

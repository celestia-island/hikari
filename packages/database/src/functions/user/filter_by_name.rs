use anyhow::Result;
use sea_orm::{ColumnTrait, EntityTrait, QueryFilter};

use crate::{
    models::user::{Column, Entity, Model},
    DB_CONN,
};

pub async fn filter_by_name(name: String) -> Result<Model> {
    let ret = Entity::find()
        .filter(Column::Name.eq(name))
        .one(DB_CONN.lock().await.get_mut())
        .await?
        .unwrap();
    Ok(ret)
}

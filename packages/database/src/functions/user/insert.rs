use anyhow::Result;

use sea_orm::{ActiveValue::NotSet, EntityTrait};

use crate::{
    models::user::{ActiveModel, Entity, Model},
    DB_CONN,
};

pub async fn insert(item: Model) -> Result<()> {
    let item = ActiveModel {
        id: NotSet,
        ..item.into()
    };

    Entity::insert(item)
        .exec(DB_CONN.lock().await.get_mut())
        .await?;

    Ok(())
}

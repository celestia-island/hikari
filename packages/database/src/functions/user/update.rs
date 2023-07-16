use anyhow::Result;

use sea_orm::{ActiveModelTrait, ActiveValue::NotSet};

use crate::{
    models::user::{ActiveModel, Model},
    DB_CONN,
};

pub async fn update(item: Model) -> Result<()> {
    let model = ActiveModel {
        id: NotSet,
        ..item.clone().into()
    };
    model.update(DB_CONN.lock().await.get_mut()).await?;
    Ok(())
}

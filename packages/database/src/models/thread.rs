use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel, Deserialize, Serialize)]
#[sea_orm(table_name = "threads")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,

    pub channel: Uuid,
    pub tags: Json,
    pub author: Uuid,
    pub timestamp: ChronoDateTimeUtc,

    pub title: String,
    pub content: String,
}

#[derive(Copy, Clone, Debug, EnumIter)]
pub enum Relation {
    Channel,
    Author,
}

impl RelationTrait for Relation {
    fn def(&self) -> RelationDef {
        match self {
            Self::Channel => Entity::belongs_to(super::channel::Entity)
                .from(Column::Channel)
                .to(super::channel::Column::Id)
                .into(),
            Self::Author => Entity::belongs_to(super::user::Entity)
                .from(Column::Author)
                .to(super::user::Column::Id)
                .into(),
        }
    }
}

impl Related<super::channel::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Channel.def()
    }
}

impl Related<super::user::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Author.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}

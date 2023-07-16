use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

use hikari_utils::types::models::{Permission as DTOPermission, UserType as DTO};

#[derive(Clone, Debug, PartialEq, EnumIter, DeriveActiveEnum, Deserialize, Serialize)]
#[sea_orm(rs_type = "String", db_type = "String(Some(1))")]
pub enum Permission {
    #[sea_orm(string_value = "root")]
    Root,
    #[sea_orm(string_value = "manager")]
    Manager,
    #[sea_orm(string_value = "user")]
    User,
}

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Deserialize, Serialize)]
#[sea_orm(table_name = "users")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub token: Uuid,

    pub name: String,
    pub password_hash: String,

    pub permission: Permission,
}

impl Default for Model {
    fn default() -> Self {
        Self {
            id: Uuid::new_v4(),
            token: Uuid::nil(),

            name: Default::default(),
            password_hash: Default::default(),

            permission: Permission::Manager,
        }
    }
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}

// Convert between PO and DTO

impl From<DTO> for Model {
    fn from(info: DTO) -> Self {
        Self {
            id: info.id,
            name: info.name,
            permission: info.permission.into(),

            ..Default::default()
        }
    }
}

impl From<Model> for DTO {
    fn from(model: Model) -> Self {
        Self {
            id: model.id,

            name: model.name,
            permission: model.permission.into(),
        }
    }
}

impl From<DTOPermission> for Permission {
    fn from(permission: DTOPermission) -> Self {
        match permission {
            DTOPermission::Root => Self::Root,
            DTOPermission::Manager => Self::Manager,
            DTOPermission::User => Self::User,
        }
    }
}

impl From<Permission> for DTOPermission {
    fn from(permission: Permission) -> Self {
        match permission {
            Permission::Root => Self::Root,
            Permission::Manager => Self::Manager,
            Permission::User => Self::User,
        }
    }
}

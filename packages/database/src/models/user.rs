use std::borrow::Cow;

use serde::{Deserialize, Serialize};
use uuid::Uuid;

use hikari_utils::types::functions::user::Permission;

#[derive(Clone, Debug, PartialEq, Deserialize, Serialize)]
pub struct Model {
    pub id: Uuid,
    pub token: Uuid,

    pub name: Cow<'static, str>,
    pub password_hash: Cow<'static, str>,

    pub permission: Permission,
}

impl Default for Model {
    fn default() -> Self {
        Self {
            id: Uuid::new_v4(),
            token: Uuid::nil(),

            name: Default::default(),
            password_hash: Default::default(),

            permission: Permission::Admin,
        }
    }
}

// Convert between PO and DTO

use hikari_utils::types::functions::user as DTO;

impl From<DTO::Model> for Model {
    fn from(item: DTO::Model) -> Self {
        Self {
            id: item.id,
            token: item.token,

            name: item.name.into(),
            password_hash: item.password_hash.into(),

            permission: item.permission,
        }
    }
}

impl From<Model> for DTO::Model {
    fn from(item: Model) -> Self {
        Self {
            id: item.id,
            token: item.token,

            name: item.name.into(),
            password_hash: item.password_hash.into(),

            permission: item.permission,
        }
    }
}

use serde::{Deserialize, Serialize};
use uuid::Uuid;

use hikari_utils::types::functions::user::Permission;

#[derive(Clone, Debug, PartialEq, Deserialize, Serialize)]
pub struct Model {
    pub token: Uuid,

    pub name: String,
    pub password_hash: String,

    pub permission: Permission,
}

// Convert between PO and DTO

use hikari_utils::types::functions::user as DTO;

impl From<DTO::Model> for Model {
    fn from(item: DTO::Model) -> Self {
        Self {
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
            id: uuid::Uuid::nil(),
            token: item.token,

            name: item.name.into(),
            password_hash: item.password_hash.into(),

            permission: item.permission,
        }
    }
}

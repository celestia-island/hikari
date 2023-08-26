use serde::{Deserialize, Serialize};
use strum_macros::EnumString;
use uuid::Uuid;

#[derive(Clone, Debug, PartialEq, Deserialize, Serialize, EnumString)]
#[serde(rename_all = "snake_case")]
pub enum Permission {
    Admin,
    User,
}

#[derive(Clone, Debug, PartialEq, Deserialize, Serialize)]
pub struct Model {
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

            permission: Permission::Admin,
        }
    }
}

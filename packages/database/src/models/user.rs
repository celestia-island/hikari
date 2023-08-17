use std::borrow::Cow;

use serde::{Deserialize, Serialize};
use strum_macros::EnumString;
use uuid::Uuid;

#[derive(Clone, Debug, PartialEq, Deserialize, Serialize, EnumString)]
pub enum Permission {
    #[strum(serialize = "admin")]
    Admin,
    #[strum(serialize = "user")]
    User,
}

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

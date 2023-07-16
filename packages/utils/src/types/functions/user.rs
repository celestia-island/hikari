use serde::{Deserialize, Serialize};
use strum_macros::{Display, EnumIter};
use uuid::Uuid;

#[derive(Copy, Clone, Debug, PartialEq, EnumIter, Deserialize, Serialize, Display)]
pub enum Permission {
    Root,
    Manager,
    User,
}

#[derive(Clone, Debug, PartialEq, Deserialize, Serialize)]
pub struct UserType {
    pub id: Uuid,

    pub name: String,

    pub permission: Permission,
}

impl Default for UserType {
    fn default() -> Self {
        Self {
            id: Uuid::new_v4(),

            name: Default::default(),

            permission: Permission::User,
        }
    }
}

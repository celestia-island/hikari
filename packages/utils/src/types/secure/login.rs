use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct LoginInfo {
    pub name: String,
    pub password_hash: String,
}

impl Default for LoginInfo {
    fn default() -> Self {
        Self {
            name: "".to_string(),
            password_hash: "".to_string(),
        }
    }
}

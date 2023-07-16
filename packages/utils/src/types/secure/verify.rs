use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct VerifyInfo {
    pub name: String,
    pub token: Uuid,
}

impl Default for VerifyInfo {
    fn default() -> Self {
        Self {
            name: "".to_string(),
            token: Uuid::nil(),
        }
    }
}

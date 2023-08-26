use chrono::prelude::*;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Clone, Debug, PartialEq, Eq, Deserialize, Serialize)]
pub struct Model {
    pub parent: Option<Uuid>,
    pub author: Uuid,
    pub timestamp: DateTime<Utc>,

    pub content: String,
}

// TODO - Convert between PO and DTO

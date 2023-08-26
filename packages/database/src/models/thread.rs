use chrono::prelude::*;
use serde::{Deserialize, Serialize};
use serde_json::Value as Json;
use uuid::Uuid;

#[derive(Clone, Debug, PartialEq, Eq, Deserialize, Serialize)]
pub struct Model {
    pub channel: Uuid,
    pub tags: Json,
    pub author: Uuid,
    pub timestamp: DateTime<Utc>,

    pub title: String,
    pub content: String,
}

// TODO - Convert between PO and DTO

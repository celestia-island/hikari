use std::borrow::Cow;

use chrono::prelude::*;
use serde::{Deserialize, Serialize};
use serde_json::Value as Json;
use uuid::Uuid;

#[derive(Clone, Debug, PartialEq, Eq, Deserialize, Serialize)]
pub struct Model {
    pub id: Uuid,

    pub channel: Uuid,
    pub tags: Json,
    pub author: Uuid,
    pub timestamp: DateTime<Utc>,

    pub title: Cow<'static, str>,
    pub content: Cow<'static, str>,
}

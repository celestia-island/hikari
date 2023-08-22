use std::borrow::Cow;

use chrono::prelude::*;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Clone, Debug, PartialEq, Eq, Deserialize, Serialize)]
pub struct Model {
    pub id: Uuid,

    pub parent: Option<Uuid>,
    pub author: Uuid,
    pub timestamp: DateTime<Utc>,

    pub content: Cow<'static, str>,
}

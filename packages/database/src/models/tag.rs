use std::borrow::Cow;

use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Clone, Debug, PartialEq, Eq, Deserialize, Serialize)]
pub struct Model {
    pub id: Uuid,

    pub parent: Option<Uuid>,

    pub label: Cow<'static, str>,
}

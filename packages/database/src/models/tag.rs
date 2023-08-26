use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Clone, Debug, PartialEq, Eq, Deserialize, Serialize)]
pub struct Model {
    pub parent: Option<Uuid>,

    pub label: String,
}

// TODO - Convert between PO and DTO

use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq, Deserialize, Serialize)]
pub struct Model {
    pub label: String,
}

// TODO - Convert between PO and DTO

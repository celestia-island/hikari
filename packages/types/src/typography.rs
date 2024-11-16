// TODO: fonts, scales and default font size

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FontSize {
    H1,
    H2,
    H3,
    H4,
    H5,
    H6,
    Px(f64),
    Em(f64),
    Rem(f64),
    Custom(String),
}

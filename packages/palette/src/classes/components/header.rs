//! Header component classes

use serde::{Deserialize, Serialize};

use crate::classes::UtilityClass;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Header {
    Header,
    Sticky,
    Md,
    Transparent,
    Left,
    Right,
    Toggle,
}

impl UtilityClass for Header {
    fn as_suffix(&self) -> &'static str {
        match self {
            Header::Header => "header",
            Header::Sticky => "header-sticky",
            Header::Md => "header-md",
            Header::Transparent => "header-transparent",
            Header::Left => "header-left",
            Header::Right => "header-right",
            Header::Toggle => "header-toggle",
        }
    }
}

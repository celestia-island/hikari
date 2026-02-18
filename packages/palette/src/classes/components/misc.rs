//! Miscellaneous component classes (Arrow, Portal)

use serde::{Deserialize, Serialize};

use crate::classes::UtilityClass;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ArrowClass {
    Arrow,
    ArrowRight,
    ArrowLeft,
    ArrowUp,
    ArrowDown,
    Size14,
    Size16,
    Size20,
}

impl UtilityClass for ArrowClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            ArrowClass::Arrow => "arrow",
            ArrowClass::ArrowRight => "arrow-right",
            ArrowClass::ArrowLeft => "arrow-left",
            ArrowClass::ArrowUp => "arrow-up",
            ArrowClass::ArrowDown => "arrow-down",
            ArrowClass::Size14 => "arrow-14",
            ArrowClass::Size16 => "arrow-16",
            ArrowClass::Size20 => "arrow-20",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum PortalClass {
    PortalRoot,
}

impl UtilityClass for PortalClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            PortalClass::PortalRoot => "portal-root",
        }
    }
}

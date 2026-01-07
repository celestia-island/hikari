//! Effects utility classes
//!
//! Shadow, opacity, border radius, and other visual effects.

use serde::{Serialize, Deserialize};
use super::UtilityClass;

/// Border radius utilities
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum BorderRadius {
    None,
    Sm,
    Rounded,
    Lg,
    Xl,
    Full,
}

impl UtilityClass for BorderRadius {
    fn as_suffix(&self) -> &'static str {
        match self {
            BorderRadius::None => "rounded-none",
            BorderRadius::Sm => "rounded-sm",
            BorderRadius::Rounded => "rounded",
            BorderRadius::Lg => "rounded-lg",
            BorderRadius::Xl => "rounded-xl",
            BorderRadius::Full => "rounded-full",
        }
    }
}

/// Shadow utilities
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Shadow {
    Md,
    Lg,
}

impl UtilityClass for Shadow {
    fn as_suffix(&self) -> &'static str {
        match self {
            Shadow::Md => "shadow-md",
            Shadow::Lg => "shadow-lg",
        }
    }
}

/// Opacity utilities
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Opacity {
    O0,
    O50,
    O100,
}

impl UtilityClass for Opacity {
    fn as_suffix(&self) -> &'static str {
        match self {
            Opacity::O0 => "opacity-0",
            Opacity::O50 => "opacity-50",
            Opacity::O100 => "opacity-100",
        }
    }
}

/// Cursor utilities
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Cursor {
    Pointer,
    NotAllowed,
}

impl UtilityClass for Cursor {
    fn as_suffix(&self) -> &'static str {
        match self {
            Cursor::Pointer => "cursor-pointer",
            Cursor::NotAllowed => "cursor-not-allowed",
        }
    }
}

/// Pointer events utilities
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum PointerEvents {
    None,
    Auto,
}

impl UtilityClass for PointerEvents {
    fn as_suffix(&self) -> &'static str {
        match self {
            PointerEvents::None => "pointer-events-none",
            PointerEvents::Auto => "pointer-events-auto",
        }
    }
}

/// User select utilities
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum UserSelect {
    None,
    Text,
    All,
}

impl UtilityClass for UserSelect {
    fn as_suffix(&self) -> &'static str {
        match self {
            UserSelect::None => "select-none",
            UserSelect::Text => "select-text",
            UserSelect::All => "select-all",
        }
    }
}

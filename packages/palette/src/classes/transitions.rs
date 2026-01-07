//! Transition utility classes
//!
//! Animation and transition utilities.

use serde::{Serialize, Deserialize};
use super::UtilityClass;

/// Transition property utilities
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Transition {
    All,
    Colors,
    Transform,
}

impl UtilityClass for Transition {
    fn as_suffix(&self) -> &'static str {
        match self {
            Transition::All => "transition-all",
            Transition::Colors => "transition-colors",
            Transition::Transform => "transition-transform",
        }
    }
}

/// Transition duration utilities
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Duration {
    D150,
    D300,
    D500,
}

impl UtilityClass for Duration {
    fn as_suffix(&self) -> &'static str {
        match self {
            Duration::D150 => "duration-150",
            Duration::D300 => "duration-300",
            Duration::D500 => "duration-500",
        }
    }
}

/// Transition timing function utilities
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Ease {
    InOut,
}

impl UtilityClass for Ease {
    fn as_suffix(&self) -> &'static str {
        match self {
            Ease::InOut => "ease-in-out",
        }
    }
}

/// Transform utilities
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Transform {
    TranslateX0,
    TranslateXFull,
    TranslateY0,
}

impl UtilityClass for Transform {
    fn as_suffix(&self) -> &'static str {
        match self {
            Transform::TranslateX0 => "translate-x-0",
            Transform::TranslateXFull => "translate-x-full",
            Transform::TranslateY0 => "translate-y-0",
        }
    }
}

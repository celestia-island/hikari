//! Layout utility classes
//!
//! Position, overflow, and other layout properties.

use serde::{Serialize, Deserialize};
use super::UtilityClass;

/// Position property
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Position {
    Static,
    Relative,
    Absolute,
    Fixed,
    Sticky,
}

impl UtilityClass for Position {
    fn as_suffix(&self) -> &'static str {
        match self {
            Position::Static => "static",
            Position::Relative => "relative",
            Position::Absolute => "absolute",
            Position::Fixed => "fixed",
            Position::Sticky => "sticky",
        }
    }
}

/// Overflow utilities
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Overflow {
    Hidden,
    Auto,
    Scroll,
}

impl UtilityClass for Overflow {
    fn as_suffix(&self) -> &'static str {
        match self {
            Overflow::Hidden => "overflow-hidden",
            Overflow::Auto => "overflow-auto",
            Overflow::Scroll => "overflow-scroll",
        }
    }
}

/// Overflow X utilities
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum OverflowX {
    Hidden,
    Auto,
    Scroll,
}

impl UtilityClass for OverflowX {
    fn as_suffix(&self) -> &'static str {
        match self {
            OverflowX::Hidden => "overflow-x-hidden",
            OverflowX::Auto => "overflow-x-auto",
            OverflowX::Scroll => "overflow-x-scroll",
        }
    }
}

/// Overflow Y utilities
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum OverflowY {
    Hidden,
    Auto,
    Scroll,
}

impl UtilityClass for OverflowY {
    fn as_suffix(&self) -> &'static str {
        match self {
            OverflowY::Hidden => "overflow-y-hidden",
            OverflowY::Auto => "overflow-y-auto",
            OverflowY::Scroll => "overflow-y-scroll",
        }
    }
}

/// Z-index utilities
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ZIndex {
    Z0,
    Z10,
    Z20,
    Z30,
    Z40,
    Z50,
    Auto,
}

impl UtilityClass for ZIndex {
    fn as_suffix(&self) -> &'static str {
        match self {
            ZIndex::Z0 => "z-0",
            ZIndex::Z10 => "z-10",
            ZIndex::Z20 => "z-20",
            ZIndex::Z30 => "z-30",
            ZIndex::Z40 => "z-40",
            ZIndex::Z50 => "z-50",
            ZIndex::Auto => "z-auto",
        }
    }
}

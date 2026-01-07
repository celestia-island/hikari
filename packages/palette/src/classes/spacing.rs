//! Spacing utility classes
//!
//! Padding, margin, and related spacing utilities.

use serde::{Serialize, Deserialize};
use super::UtilityClass;

/// Padding all sides
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Padding {
    P0, P1, P2, P3, P4, P5, P6, P8, P10, P12,
}

impl UtilityClass for Padding {
    fn as_suffix(&self) -> &'static str {
        match self {
            Padding::P0 => "p-0",
            Padding::P1 => "p-1",
            Padding::P2 => "p-2",
            Padding::P3 => "p-3",
            Padding::P4 => "p-4",
            Padding::P5 => "p-5",
            Padding::P6 => "p-6",
            Padding::P8 => "p-8",
            Padding::P10 => "p-10",
            Padding::P12 => "p-12",
        }
    }
}

/// Padding X axis (left and right)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum PaddingX {
    Px1, Px2, Px3, Px4, Px6,
}

impl UtilityClass for PaddingX {
    fn as_suffix(&self) -> &'static str {
        match self {
            PaddingX::Px1 => "px-1",
            PaddingX::Px2 => "px-2",
            PaddingX::Px3 => "px-3",
            PaddingX::Px4 => "px-4",
            PaddingX::Px6 => "px-6",
        }
    }
}

/// Padding Y axis (top and bottom)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum PaddingY {
    Py1, Py2, Py3, Py4,
}

impl UtilityClass for PaddingY {
    fn as_suffix(&self) -> &'static str {
        match self {
            PaddingY::Py1 => "py-1",
            PaddingY::Py2 => "py-2",
            PaddingY::Py3 => "py-3",
            PaddingY::Py4 => "py-4",
        }
    }
}

/// Margin all sides
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Margin {
    M0, M1, M2, M3, M4, M5, M6, M8, Auto,
}

impl UtilityClass for Margin {
    fn as_suffix(&self) -> &'static str {
        match self {
            Margin::M0 => "m-0",
            Margin::M1 => "m-1",
            Margin::M2 => "m-2",
            Margin::M3 => "m-3",
            Margin::M4 => "m-4",
            Margin::M5 => "m-5",
            Margin::M6 => "m-6",
            Margin::M8 => "m-8",
            Margin::Auto => "m-auto",
        }
    }
}

/// Margin X axis
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum MarginX {
    MxAuto,
}

impl UtilityClass for MarginX {
    fn as_suffix(&self) -> &'static str {
        match self {
            MarginX::MxAuto => "mx-auto",
        }
    }
}

/// Margin Y axis
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum MarginY {
    MyAuto,
}

impl UtilityClass for MarginY {
    fn as_suffix(&self) -> &'static str {
        match self {
            MarginY::MyAuto => "my-auto",
        }
    }
}

/// Space between children
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SpaceBetween {
    SpaceY2, SpaceY4, SpaceY6,
}

impl UtilityClass for SpaceBetween {
    fn as_suffix(&self) -> &'static str {
        match self {
            SpaceBetween::SpaceY2 => "space-y-2",
            SpaceBetween::SpaceY4 => "space-y-4",
            SpaceBetween::SpaceY6 => "space-y-6",
        }
    }
}

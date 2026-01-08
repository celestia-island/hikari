//! Spacing utility classes
//!
//! Padding, margin, and related spacing utilities.

use super::UtilityClass;
use serde::{Deserialize, Serialize};

/// Padding all sides
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Padding {
    P0,
    P1,
    P2,
    P3,
    P4,
    P5,
    P6,
    P8,
    P10,
    P12,
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
    Px1,
    Px2,
    Px3,
    Px4,
    Px6,
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
    Py1,
    Py2,
    Py3,
    Py4,
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
    M0,
    M1,
    M2,
    M3,
    M4,
    M5,
    M6,
    M8,
    Auto,
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

/// Margin Top
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum MarginTop {
    Mt0,
    Mt1,
    Mt2,
    Mt3,
    Mt4,
    Mt5,
    Mt6,
    Mt8,
}

impl UtilityClass for MarginTop {
    fn as_suffix(&self) -> &'static str {
        match self {
            MarginTop::Mt0 => "mt-0",
            MarginTop::Mt1 => "mt-1",
            MarginTop::Mt2 => "mt-2",
            MarginTop::Mt3 => "mt-3",
            MarginTop::Mt4 => "mt-4",
            MarginTop::Mt5 => "mt-5",
            MarginTop::Mt6 => "mt-6",
            MarginTop::Mt8 => "mt-8",
        }
    }
}

/// Margin Bottom
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum MarginBottom {
    Mb0,
    Mb1,
    Mb2,
    Mb3,
    Mb4,
    Mb5,
    Mb6,
    Mb8,
}

impl UtilityClass for MarginBottom {
    fn as_suffix(&self) -> &'static str {
        match self {
            MarginBottom::Mb0 => "mb-0",
            MarginBottom::Mb1 => "mb-1",
            MarginBottom::Mb2 => "mb-2",
            MarginBottom::Mb3 => "mb-3",
            MarginBottom::Mb4 => "mb-4",
            MarginBottom::Mb5 => "mb-5",
            MarginBottom::Mb6 => "mb-6",
            MarginBottom::Mb8 => "mb-8",
        }
    }
}

/// Margin Left
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum MarginLeft {
    Ml0,
    Ml1,
    Ml2,
    Ml3,
    Ml4,
    Ml5,
    Ml6,
    Ml8,
}

impl UtilityClass for MarginLeft {
    fn as_suffix(&self) -> &'static str {
        match self {
            MarginLeft::Ml0 => "ml-0",
            MarginLeft::Ml1 => "ml-1",
            MarginLeft::Ml2 => "ml-2",
            MarginLeft::Ml3 => "ml-3",
            MarginLeft::Ml4 => "ml-4",
            MarginLeft::Ml5 => "ml-5",
            MarginLeft::Ml6 => "ml-6",
            MarginLeft::Ml8 => "ml-8",
        }
    }
}

/// Margin Right
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum MarginRight {
    Mr0,
    Mr1,
    Mr2,
    Mr3,
    Mr4,
    Mr5,
    Mr6,
    Mr8,
}

impl UtilityClass for MarginRight {
    fn as_suffix(&self) -> &'static str {
        match self {
            MarginRight::Mr0 => "mr-0",
            MarginRight::Mr1 => "mr-1",
            MarginRight::Mr2 => "mr-2",
            MarginRight::Mr3 => "mr-3",
            MarginRight::Mr4 => "mr-4",
            MarginRight::Mr5 => "mr-5",
            MarginRight::Mr6 => "mr-6",
            MarginRight::Mr8 => "mr-8",
        }
    }
}

/// Padding Top
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum PaddingTop {
    Pt0,
    Pt1,
    Pt2,
    Pt3,
    Pt4,
    Pt5,
    Pt6,
    Pt8,
}

impl UtilityClass for PaddingTop {
    fn as_suffix(&self) -> &'static str {
        match self {
            PaddingTop::Pt0 => "pt-0",
            PaddingTop::Pt1 => "pt-1",
            PaddingTop::Pt2 => "pt-2",
            PaddingTop::Pt3 => "pt-3",
            PaddingTop::Pt4 => "pt-4",
            PaddingTop::Pt5 => "pt-5",
            PaddingTop::Pt6 => "pt-6",
            PaddingTop::Pt8 => "pt-8",
        }
    }
}

/// Padding Bottom
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum PaddingBottom {
    Pb0,
    Pb1,
    Pb2,
    Pb3,
    Pb4,
    Pb5,
    Pb6,
    Pb8,
}

impl UtilityClass for PaddingBottom {
    fn as_suffix(&self) -> &'static str {
        match self {
            PaddingBottom::Pb0 => "pb-0",
            PaddingBottom::Pb1 => "pb-1",
            PaddingBottom::Pb2 => "pb-2",
            PaddingBottom::Pb3 => "pb-3",
            PaddingBottom::Pb4 => "pb-4",
            PaddingBottom::Pb5 => "pb-5",
            PaddingBottom::Pb6 => "pb-6",
            PaddingBottom::Pb8 => "pb-8",
        }
    }
}

/// Padding Left
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum PaddingLeft {
    Pl0,
    Pl1,
    Pl2,
    Pl3,
    Pl4,
    Pl5,
    Pl6,
    Pl8,
}

impl UtilityClass for PaddingLeft {
    fn as_suffix(&self) -> &'static str {
        match self {
            PaddingLeft::Pl0 => "pl-0",
            PaddingLeft::Pl1 => "pl-1",
            PaddingLeft::Pl2 => "pl-2",
            PaddingLeft::Pl3 => "pl-3",
            PaddingLeft::Pl4 => "pl-4",
            PaddingLeft::Pl5 => "pl-5",
            PaddingLeft::Pl6 => "pl-6",
            PaddingLeft::Pl8 => "pl-8",
        }
    }
}

/// Padding Right
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum PaddingRight {
    Pr0,
    Pr1,
    Pr2,
    Pr3,
    Pr4,
    Pr5,
    Pr6,
    Pr8,
}

impl UtilityClass for PaddingRight {
    fn as_suffix(&self) -> &'static str {
        match self {
            PaddingRight::Pr0 => "pr-0",
            PaddingRight::Pr1 => "pr-1",
            PaddingRight::Pr2 => "pr-2",
            PaddingRight::Pr3 => "pr-3",
            PaddingRight::Pr4 => "pr-4",
            PaddingRight::Pr5 => "pr-5",
            PaddingRight::Pr6 => "pr-6",
            PaddingRight::Pr8 => "pr-8",
        }
    }
}

/// Space between children
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SpaceBetween {
    SpaceY2,
    SpaceY4,
    SpaceY6,
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

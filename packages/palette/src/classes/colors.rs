//! Color utility classes
//!
//! Text color, background color, and other color utilities.

use serde::{Deserialize, Serialize};

use super::UtilityClass;

/// Text color utilities
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TextColor {
    White,
    Black,
    Gray400,
    Gray500,
    Gray600,
    Gray700,
    Gray800,
    Gray900,
    Primary,
}

impl UtilityClass for TextColor {
    fn as_suffix(&self) -> &'static str {
        match self {
            TextColor::White => "text-white",
            TextColor::Black => "text-black",
            TextColor::Gray400 => "text-gray-400",
            TextColor::Gray500 => "text-gray-500",
            TextColor::Gray600 => "text-gray-600",
            TextColor::Gray700 => "text-gray-700",
            TextColor::Gray800 => "text-gray-800",
            TextColor::Gray900 => "text-gray-900",
            TextColor::Primary => "text-primary",
        }
    }
}

/// Background color utilities
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum BgColor {
    White,
    Black,
    Transparent,
    Gray50,
    Gray100,
    Gray200,
    Gray300,
    Gray500,
    Gray700,
    Gray900,
    Primary,
}

impl UtilityClass for BgColor {
    fn as_suffix(&self) -> &'static str {
        match self {
            BgColor::White => "bg-white",
            BgColor::Black => "bg-black",
            BgColor::Transparent => "bg-transparent",
            BgColor::Gray50 => "bg-gray-50",
            BgColor::Gray100 => "bg-gray-100",
            BgColor::Gray200 => "bg-gray-200",
            BgColor::Gray300 => "bg-gray-300",
            BgColor::Gray500 => "bg-gray-500",
            BgColor::Gray700 => "bg-gray-700",
            BgColor::Gray900 => "bg-gray-900",
            BgColor::Primary => "bg-primary",
        }
    }
}

/// Border color utilities
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum BorderColor {
    Gray200,
    Gray300,
    Transparent,
}

impl UtilityClass for BorderColor {
    fn as_suffix(&self) -> &'static str {
        match self {
            BorderColor::Gray200 => "border-gray-200",
            BorderColor::Gray300 => "border-gray-300",
            BorderColor::Transparent => "border-transparent",
        }
    }
}

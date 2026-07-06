//! Color utility classes
//!
//! Text color, background color, and other color utilities.

use serde::{Deserialize, Serialize};

use super::UtilityClass;

/// Text color utilities - 语义化颜色，支持主题切换
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TextColor {
    White,
    Black,
    Primary,
    Secondary,
    Muted,
    Accent,
}

impl UtilityClass for TextColor {
    fn as_suffix(&self) -> &'static str {
        match self {
            TextColor::White => "text-white",
            TextColor::Black => "text-black",
            TextColor::Primary => "text-primary",
            TextColor::Secondary => "text-secondary",
            TextColor::Muted => "text-muted",
            TextColor::Accent => "text-accent",
        }
    }
}

/// Background color utilities - 语义化背景色，支持主题切换
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum BgColor {
    White,
    Black,
    Transparent,
    Surface,
    Primary,
    Secondary,
    Accent,
}

impl UtilityClass for BgColor {
    fn as_suffix(&self) -> &'static str {
        match self {
            BgColor::White => "bg-white",
            BgColor::Black => "bg-black",
            BgColor::Transparent => "bg-transparent",
            BgColor::Surface => "bg-surface",
            BgColor::Primary => "bg-primary",
            BgColor::Secondary => "bg-secondary",
            BgColor::Accent => "bg-accent",
        }
    }
}

/// Border color utilities - 语义化边框色，支持主题切换
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum BorderColor {
    Transparent,
}

impl UtilityClass for BorderColor {
    fn as_suffix(&self) -> &'static str {
        match self {
            BorderColor::Transparent => "border-transparent",
        }
    }
}

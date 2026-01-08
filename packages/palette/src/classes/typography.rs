//! Typography utility classes
//!
//! Font size, weight, alignment, and other text utilities.

use serde::{Deserialize, Serialize};

use super::UtilityClass;

/// Font size utilities
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum FontSize {
    Xs,
    Sm,
    Base,
    Lg,
    Xl,
    X2xl,
    X3xl,
    X4xl,
}

impl UtilityClass for FontSize {
    fn as_suffix(&self) -> &'static str {
        match self {
            FontSize::Xs => "text-xs",
            FontSize::Sm => "text-sm",
            FontSize::Base => "text-base",
            FontSize::Lg => "text-lg",
            FontSize::Xl => "text-xl",
            FontSize::X2xl => "text-2xl",
            FontSize::X3xl => "text-3xl",
            FontSize::X4xl => "text-4xl",
        }
    }
}

/// Font weight utilities
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum FontWeight {
    Normal,
    Medium,
    Semibold,
    Bold,
}

impl UtilityClass for FontWeight {
    fn as_suffix(&self) -> &'static str {
        match self {
            FontWeight::Normal => "font-normal",
            FontWeight::Medium => "font-medium",
            FontWeight::Semibold => "font-semibold",
            FontWeight::Bold => "font-bold",
        }
    }
}

/// Text alignment
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TextAlign {
    Left,
    Center,
    Right,
}

impl UtilityClass for TextAlign {
    fn as_suffix(&self) -> &'static str {
        match self {
            TextAlign::Left => "text-left",
            TextAlign::Center => "text-center",
            TextAlign::Right => "text-right",
        }
    }
}

/// Text transform
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TextTransform {
    Uppercase,
    Lowercase,
    Capitalize,
}

impl UtilityClass for TextTransform {
    fn as_suffix(&self) -> &'static str {
        match self {
            TextTransform::Uppercase => "uppercase",
            TextTransform::Lowercase => "lowercase",
            TextTransform::Capitalize => "capitalize",
        }
    }
}

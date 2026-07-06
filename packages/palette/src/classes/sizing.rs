//! Sizing utility classes
//!
//! Width, height, and other sizing utilities.

use serde::{Deserialize, Serialize};

use super::UtilityClass;

/// Width utilities
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Width {
    Full,
    Screen,
    Auto,
    W6,
    W8,
    W12,
    W16,
    W24,
    W64,
}

impl UtilityClass for Width {
    fn as_suffix(&self) -> &'static str {
        match self {
            Width::Full => "w-full",
            Width::Screen => "w-screen",
            Width::Auto => "w-auto",
            Width::W6 => "w-6",
            Width::W8 => "w-8",
            Width::W12 => "w-12",
            Width::W16 => "w-16",
            Width::W24 => "w-24",
            Width::W64 => "w-64",
        }
    }
}

/// Height utilities
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Height {
    Full,
    Screen,
    Auto,
    H6,
    H8,
    H10,
    H12,
}

impl UtilityClass for Height {
    fn as_suffix(&self) -> &'static str {
        match self {
            Height::Full => "h-full",
            Height::Screen => "h-screen",
            Height::Auto => "h-auto",
            Height::H6 => "h-6",
            Height::H8 => "h-8",
            Height::H10 => "h-10",
            Height::H12 => "h-12",
        }
    }
}

/// Min-width utilities
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum MinWidth {
    MinW0,
}

impl UtilityClass for MinWidth {
    fn as_suffix(&self) -> &'static str {
        match self {
            MinWidth::MinW0 => "min-w-0",
        }
    }
}

/// Max-width utilities
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum MaxWidth {
    MaxWFull,
    MaxW2xl,
    MaxW3xl,
    MaxW4xl,
    MaxWLogo,
}

impl UtilityClass for MaxWidth {
    fn as_suffix(&self) -> &'static str {
        match self {
            MaxWidth::MaxWFull => "max-w-full",
            MaxWidth::MaxW2xl => "max-w-2xl",
            MaxWidth::MaxW3xl => "max-w-3xl",
            MaxWidth::MaxW4xl => "max-w-4xl",
            MaxWidth::MaxWLogo => "max-w-logo",
        }
    }
}

/// Object-fit utilities for images
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ObjectFit {
    Contain,
    Cover,
    Fill,
    None,
    ScaleDown,
}

impl UtilityClass for ObjectFit {
    fn as_suffix(&self) -> &'static str {
        match self {
            ObjectFit::Contain => "object-contain",
            ObjectFit::Cover => "object-cover",
            ObjectFit::Fill => "object-fill",
            ObjectFit::None => "object-none",
            ObjectFit::ScaleDown => "object-scale-down",
        }
    }
}

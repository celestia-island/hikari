//! Color utility classes.

use tairitsu_style::TypedClass;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TextColor {
    White,
    Black,
    Primary,
    Secondary,
    Muted,
    Accent,
}

impl TypedClass for TextColor {
    fn class_name(&self) -> &'static str {
        match self {
            Self::White => "hi-text-white",
            Self::Black => "hi-text-black",
            Self::Primary => "hi-text-primary",
            Self::Secondary => "hi-text-secondary",
            Self::Muted => "hi-text-muted",
            Self::Accent => "hi-text-accent",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BgColor {
    White,
    Black,
    Transparent,
    Surface,
    Primary,
    Secondary,
    Accent,
}

impl TypedClass for BgColor {
    fn class_name(&self) -> &'static str {
        match self {
            Self::White => "hi-bg-white",
            Self::Black => "hi-bg-black",
            Self::Transparent => "hi-bg-transparent",
            Self::Surface => "hi-bg-surface",
            Self::Primary => "hi-bg-primary",
            Self::Secondary => "hi-bg-secondary",
            Self::Accent => "hi-bg-accent",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BorderColor {
    Transparent,
}

impl TypedClass for BorderColor {
    fn class_name(&self) -> &'static str {
        match self {
            Self::Transparent => "hi-border-transparent",
        }
    }
}

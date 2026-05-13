//! Typography utility classes.

use tairitsu_style::TypedClass;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
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

impl TypedClass for FontSize {
    fn class_name(&self) -> &'static str {
        match self {
            Self::Xs => "hi-text-xs",
            Self::Sm => "hi-text-sm",
            Self::Base => "hi-text-base",
            Self::Lg => "hi-text-lg",
            Self::Xl => "hi-text-xl",
            Self::X2xl => "hi-text-2xl",
            Self::X3xl => "hi-text-3xl",
            Self::X4xl => "hi-text-4xl",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FontWeight {
    Normal,
    Medium,
    Semibold,
    Bold,
}

impl TypedClass for FontWeight {
    fn class_name(&self) -> &'static str {
        match self {
            Self::Normal => "hi-font-normal",
            Self::Medium => "hi-font-medium",
            Self::Semibold => "hi-font-semibold",
            Self::Bold => "hi-font-bold",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TextAlign {
    Left,
    Center,
    Right,
}

impl TypedClass for TextAlign {
    fn class_name(&self) -> &'static str {
        match self {
            Self::Left => "hi-text-left",
            Self::Center => "hi-text-center",
            Self::Right => "hi-text-right",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TextTransform {
    Uppercase,
    Lowercase,
    Capitalize,
}

impl TypedClass for TextTransform {
    fn class_name(&self) -> &'static str {
        match self {
            Self::Uppercase => "hi-uppercase",
            Self::Lowercase => "hi-lowercase",
            Self::Capitalize => "hi-capitalize",
        }
    }
}
